import express from 'express';
import multer from 'multer';
import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = express.Router();

// Configure multer for template uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadsDir = path.join(__dirname, '../../uploads/templates');
    await fs.mkdir(uploadsDir, { recursive: true });
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    cb(null, `temp_${Date.now()}${path.extname(file.originalname)}`);
  }
});

const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// Validation constants
const STATIC_COLUMNS = ['Product', 'Verity', 'Packing'];
const EMPLOYEE_BLOCK_HEADERS = ['Invoice Amount', 'Collected Amount', 'Outstanding', 'Collection %'];

/**
 * Validates Excel template structure
 * @param {string} filePath - Path to uploaded Excel file
 * @param {string} metric - The type of metric
 */
export async function validateTemplateStructure(filePath, metric) {
  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    const sheet = workbook.worksheets[0];
    if (!sheet) return { valid: false, error: 'No worksheet found.' };

    const m = (metric || '').toLowerCase();
    const expectedStatic = (m === 'paymentcollection' || m === 'activity')
      ? ['Date', 'Day', 'General Notes']
      : ['Product', 'Verity', 'Packing'];

    // Find header row (check row 2)
    let headerRow = sheet.getRow(2);
    let firstVal = headerRow.getCell(1).value ? String(headerRow.getCell(1).value).trim().toLowerCase() : '';
    
    if (firstVal !== expectedStatic[0].toLowerCase()) {
      for (let r = 1; r <= 5; r++) {
        const val = sheet.getRow(r).getCell(1).value ? String(sheet.getRow(r).getCell(1).value).trim().toLowerCase() : '';
        if (val === expectedStatic[0].toLowerCase()) {
          headerRow = sheet.getRow(r);
          break;
        }
      }
    }

    // Validate static columns
    for (let i = 0; i < expectedStatic.length; i++) {
      const actual = headerRow.getCell(i + 1).value ? String(headerRow.getCell(i + 1).value).trim().toLowerCase() : '';
      if (actual !== expectedStatic[i].toLowerCase()) {
        return { valid: false, error: `Missing "${expectedStatic[i]}" column.` };
      }
    }

    // Read all headers to count employees
    const headers = [];
    for (let col = 1; col <= 200; col++) {
      const val = headerRow.getCell(col).value;
      if (col > 3 && !val && !headerRow.getCell(col + 1).value) break;
      headers.push(val ? String(val).trim().toLowerCase() : '');
    }

    let employeeCount = 0;
    let col = 4;
    while (col <= headers.length) {
      if (headers[col - 1]) employeeCount++;
      col += 4;
    }

    return { valid: true, employeeCount };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

/**
 * Clears data from template while preserving headers, formulas, and formatting
 * @param {string} sourcePath - Path to source template
 * @param {string} destPath - Path to save cleared template
 */
async function clearTemplateData(sourcePath, destPath) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(sourcePath);

  // Process ALL worksheets
  for (const sheet of workbook.worksheets) {
    // Clear data rows (starting from row 3 - assuming rows 1-2 are headers)
    const lastRow = sheet.rowCount;
    for (let rowNum = 3; rowNum <= lastRow; rowNum++) {
      const row = sheet.getRow(rowNum);
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        // Only clear if cell doesn't have a formula and it's after the static columns (Product, Verity, Packing)
        // Actually, let's just clear everything after col 3 that isn't a formula
        if (colNumber > 3 && !cell.formula) {
          cell.value = null;
        }
      });
    }
  }

  await workbook.xlsx.writeFile(destPath);
}

/**
 * GET /api/templates/activity/download
 */
router.get('/activity/download', async (req, res) => {
  try {
    const { Employee } = await import('../models/Employee.js');
    const employees = await Employee.find().sort({ firstName: 1 }).lean();
    return generateWideBlockTemplate(res, employees, 'activity');
  } catch (error) {
    console.error('Activity template error:', error);
    res.status(500).json({ error: 'Failed to generate activity template' });
  }
});

/**
 * GET /api/templates/:year/:season/paymentCollection/download
 */
router.get('/:year/:season/paymentCollection/download', async (req, res) => {
  try {
    const { Employee } = await import('../models/Employee.js');
    const employees = await Employee.find().sort({ firstName: 1 }).lean();
    return generateWideBlockTemplate(res, employees, 'paymentCollection');
  } catch (error) {
    console.error('Payment template error:', error);
    res.status(500).json({ error: 'Failed to generate payment template' });
  }
});

/**
 * GET /api/templates/:year/:season/:metric/download
 * Download template for a specific season and metric (Static Fallback)
 */
router.get('/:year/:season/:metric/download', async (req, res) => {
  try {
    const { year, season, metric } = req.params;
    const templatesDir = path.join(__dirname, '../../uploads/templates');
    const templatePath = path.join(templatesDir, `${year}_${season}_${metric}_template.xlsx`);

    // Check if template exists
    try {
      await fs.access(templatePath);
    } catch {
      return res.status(404).json({ 
        success: false,
        message: `Template for ${year} ${season} (${metric}) not found. Please ensure the year is initialized or a template is uploaded.` 
      });
    }

    // Create a temporary file with cleared data
    const tempPath = path.join(templatesDir, `temp_download_${Date.now()}.xlsx`);
    await clearTemplateData(templatePath, tempPath);

    // Send file
    res.download(tempPath, `${season}_${metric}_template.xlsx`, async (err) => {
      // Clean up temp file after download
      try {
        await fs.unlink(tempPath);
      } catch (cleanupErr) {
        console.error('Failed to cleanup temp file:', cleanupErr);
      }
      
      if (err && !res.headersSent) {
        console.error('Download error:', err);
        res.status(500).json({ error: 'Failed to download template' });
      }
    });
  } catch (error) {
    console.error('Template download error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to download template' });
    }
  }
});

async function generateWideBlockTemplate(res, employees, type) {
  const workbook = new ExcelJS.Workbook();
  const sheetName = type === 'activity' ? 'Activity Report' : 'Payment Collection';
  const sheet = workbook.addWorksheet(sheetName);
  
  const colorThemes = [
    { name: 'FFDCFCE7', header: 'FF16A34A' }, // Green
    { name: 'FFDBEAFE', header: 'FF2563EB' }, // Blue
    { name: 'FFF3E8FF', header: 'FF9333EA' }, // Purple
    { name: 'FFFFEDD5', header: 'FFEA580C' }  // Orange
  ];

  sheet.getColumn(1).width = 12; // Date
  sheet.getColumn(2).width = 12; // Day
  sheet.getColumn(3).width = 25; // General Notes
  
  sheet.getCell(2, 1).value = 'Date';
  sheet.getCell(2, 2).value = 'Day';
  sheet.getCell(2, 3).value = 'General Notes';
  [1, 2, 3].forEach(c => {
    sheet.getCell(2, c).style = {
      font: { bold: true, color: { argb: 'FFFFFFFF' } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4B5563' } },
      alignment: { horizontal: 'center', vertical: 'middle', wrapText: true }
    };
  });

  let currentCol = 4;
  employees.forEach((emp, index) => {
    const theme = colorThemes[index % colorThemes.length];
    const label = `${emp.empId} - ${emp.firstName}`;
    
    const nameCell = sheet.getCell(1, currentCol);
    nameCell.value = label;
    nameCell.style = {
      font: { bold: true, size: 12 },
      alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: theme.name } },
      border: { 
        left: { style: 'medium', color: { argb: theme.header } },
        right: { style: 'medium', color: { argb: theme.header } },
        top: { style: 'medium', color: { argb: theme.header } }
      }
    };
    sheet.mergeCells(1, currentCol, 1, currentCol + 3);
    
    const headers = type === 'activity' 
      ? ['Meeting Attended', 'Field Work', 'Remarks', 'Activity %']
      : ['Invoice Amount', 'Collected Amount', 'Outstanding', 'Collection %'];
      
    headers.forEach((h, i) => {
      const cell = sheet.getCell(2, currentCol + i);
      cell.value = h;
      cell.style = {
        font: { bold: true, color: { argb: 'FFFFFFFF' } },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: theme.header } },
        alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
        border: { 
          left: i === 0 ? { style: 'medium', color: { argb: theme.header } } : undefined,
          right: i === 3 ? { style: 'medium', color: { argb: theme.header } } : undefined
        }
      };
      sheet.getColumn(currentCol + i).width = 20;
    });

    for (let r = 3; r <= 32; r++) {
      const c1 = sheet.getCell(r, currentCol).address;
      const c2 = sheet.getCell(r, currentCol + 1).address;
      const c3 = sheet.getCell(r, currentCol + 2);
      const c4 = sheet.getCell(r, currentCol + 3);
      
      if (type === 'activity') {
        c4.value = {
          formula: `IF(${c1}="Yes",50,0) + IF(${c2}="Completed",50,IF(${c2}="In Progress",25,0))`,
          result: 0
        };
      } else {
        c3.value = { formula: `${c1}-${c2}`, result: 0 };
        c4.value = { formula: `IF(${c1}=0,0,(${c2}/${c1})*100)`, result: 0 };
      }

      c4.font = { bold: true, color: { argb: theme.header } };
      
      // Zebra striping
      if (r % 2 === 0) {
        for (let i = 0; i < 4; i++) {
          sheet.getCell(r, currentCol + i).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: theme.name.replace('FF', '0F') } };
        }
      }
      
      // Add borders and dropdowns
      for (let i = 0; i < 4; i++) {
        const cell = sheet.getCell(r, currentCol + i);
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
        };

        if (type === 'activity') {
          if (i === 0) { // Meeting Attended
            cell.dataValidation = {
              type: 'list',
              allowBlank: true,
              formulae: ['"Yes,No"']
            };
          } else if (i === 1) { // Field Work
            cell.dataValidation = {
              type: 'list',
              allowBlank: true,
              formulae: ['"Completed,In Progress,Not Started"']
            };
          }
        }
      }
    }

    currentCol += 4;
  });

  const filename = type === 'activity' ? 'Activity_Template.xlsx' : 'Payment_Collection_Template.xlsx';
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
  await workbook.xlsx.write(res);
  res.end();
}

/**
 * POST /api/templates/:year/:season/:metric/upload
 * Upload and validate template for a specific season and metric
 */
router.post('/:year/:season/:metric/upload', upload.single('file'), async (req, res) => {
  const { year, season, metric } = req.params;
  const uploadedPath = req.file?.path;

  if (!uploadedPath) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  try {
    // Validate template structure
    const validation = await validateTemplateStructure(uploadedPath, metric);

    if (!validation.valid) {
      // Delete invalid file
      await fs.unlink(uploadedPath);
      return res.status(400).json({ error: validation.error });
    }

    // Save as template for ALL seasons but only THIS metric, for current and next year
    const templatesDir = path.join(__dirname, '../../uploads/templates');
    await fs.mkdir(templatesDir, { recursive: true });
    
    const seasons = ['shiyadu', 'unadu', 'chomasu'];
    const years = [Number(year), Number(year) + 1];
    
    // Copy uploaded template to all seasons for this specific metric, for both years
    let copiedCount = 0;
    for (const y of years) {
      for (const s of seasons) {
        const templatePath = path.join(templatesDir, `${y}_${s}_${metric}_template.xlsx`);
        await fs.copyFile(uploadedPath, templatePath);
        copiedCount++;
      }
    }
    
    // Delete the temporary uploaded file
    await fs.unlink(uploadedPath);

    res.json({ 
      success: true, 
      message: `Template uploaded and applied to all ${copiedCount} seasons for ${metric} in years ${years.join(', ')}`,
      employeeCount: validation.employeeCount,
      appliedTo: `${seasons.length} seasons × ${years.length} years = ${copiedCount} templates for ${metric}`
    });
  } catch (error) {
    console.error('Template upload error:', error);
    
    // Clean up uploaded file on error
    try {
      await fs.unlink(uploadedPath);
    } catch {}

    res.status(500).json({ error: 'Failed to process template upload' });
  }
});

/**
 * Lists all products in the Combined master template
 */
router.get('/:year/:season/combined/products', async (req, res) => {
  try {
    const { year, season } = req.params;
    const templatePath = path.join(__dirname, `../../uploads/templates/${year}_${season}_combined_template.xlsx`);
    
    try {
      const st = await fs.stat(templatePath);
      if (st.size === 0) return res.json({ success: true, products: [] });
    } catch {
      return res.json({ success: true, products: [] });
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(templatePath);
    const sheet = workbook.worksheets[0];
    if (!sheet) return res.json({ success: true, products: [] });

    const products = [];
    const row1 = sheet.getRow(1);
    for (let c = 3; c <= 500; c += 9) {
      const name = String(row1.getCell(c).value || '').trim();
      if (name) {
        // Also try to find Min Price for this product
        let minPrice = 0;
        for (let r = 3; r <= 1000; r++) {
          const rowVal = String(sheet.getRow(r).getCell(1).value || '').toLowerCase();
          if (rowVal.includes('min') || rowVal.includes('nrv')) {
            for (let pc = 1; pc <= 500; pc++) {
              const cellVal = String(sheet.getRow(r).getCell(pc).value || '').toLowerCase();
              if (cellVal.includes(name.toLowerCase())) {
                minPrice = Number(sheet.getRow(r).getCell(pc + 1).value || 0);
                break;
              }
            }
          }
          if (minPrice > 0) break;
        }
        products.push({ name, minPrice });
      }
    }

    return res.json({ success: true, products });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

function convertSharedFormulasToExplicit(sheet) {
  sheet.eachRow({ includeEmpty: false }, (row) => {
    row.eachCell({ includeEmpty: false }, (cell) => {
      if (cell.type === ExcelJS.ValueType.Formula || (cell.value && typeof cell.value === 'object' && cell.value.formula)) {
        try {
          const f = cell.formula;
          const r = cell.result;
          if (f) {
            cell.value = { formula: f, result: r };
          }
        } catch {
          // ignore formula resolution errors
        }
      }
    });
  });
}

function getNextAvailableCol(sheet) {
  let maxCol = 2; // Default after Emp ID and Name
  if (sheet._merges) {
    for (const range of Object.values(sheet._merges)) {
      if (range && range.model && range.model.top <= 2) {
        if (range.model.right > maxCol) {
          maxCol = range.model.right;
        }
      }
    }
  }
  for (let c = 3; c <= 500; c++) {
    const v1 = sheet.getRow(1).getCell(c).value;
    const v2 = sheet.getRow(2).getCell(c).value;
    if ((v1 !== null && v1 !== undefined && v1 !== '') || (v2 !== null && v2 !== undefined && v2 !== '')) {
      if (c > maxCol) maxCol = c;
    }
  }
  return maxCol + 1;
}

function safeMergeHeader(sheet, r, startCol, endCol) {
  if (sheet._merges) {
    for (const key of Object.keys(sheet._merges)) {
      const range = sheet._merges[key];
      if (range && range.model) {
        const { top, bottom, left, right } = range.model;
        if (top <= r && bottom >= r && right >= startCol && left <= endCol) {
          try {
            sheet.unmergeCells(key);
          } catch {
            delete sheet._merges[key];
          }
        }
      }
    }
  }
  for (let c = startCol; c <= endCol; c++) {
    const cell = sheet.getRow(r).getCell(c);
    if (cell.isMerged && cell.master) {
      try {
        sheet.unmergeCells(cell.master.address);
      } catch {
        // ignore
      }
    }
  }
  try {
    sheet.mergeCells(r, startCol, r, endCol);
  } catch {
    // ignore
  }
}

function safeUnmergeHeader(sheet, r, startCol, endCol) {
  if (sheet._merges) {
    for (const key of Object.keys(sheet._merges)) {
      const range = sheet._merges[key];
      if (range && range.model) {
        const { top, bottom, left, right } = range.model;
        if (top <= r && bottom >= r && right >= startCol && left <= endCol) {
          try {
            sheet.unmergeCells(key);
          } catch {
            delete sheet._merges[key];
          }
        }
      }
    }
  }
  for (let c = startCol; c <= endCol; c++) {
    const cell = sheet.getRow(r).getCell(c);
    if (cell.isMerged && cell.master) {
      try {
        sheet.unmergeCells(cell.master.address);
      } catch {
        // ignore
      }
    }
  }
}

/**
 * Dynamically adds a new Product block (9 columns) to a Combined template
 */
router.post('/:year/:season/combined/add-product', async (req, res) => {
  try {
    const { year, season } = req.params;
    const { productName, minPrice } = req.body;

    if (!productName || !minPrice) {
      return res.status(400).json({ success: false, message: 'Product Name and Min Price are required' });
    }

    const seasonsToUpdate = season === 'all' ? ['shiyadu', 'unadu', 'chomasu'] : [season];
    const results = [];

    for (const s of seasonsToUpdate) {
      const templatePath = path.join(__dirname, `../../uploads/templates/${year}_${s}_combined_template.xlsx`);
      
      try {
        const st = await fs.stat(templatePath);
        if (st.size === 0) throw new Error('File empty');
      } catch {
        if (season === 'all') continue; // Skip missing ones if 'all'
        return res.status(404).json({ success: false, message: `Template for ${s} not found.` });
      }

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(templatePath);

      for (const sheet of workbook.worksheets) {
        if (sheet.name.startsWith('#')) continue;

        const nextCol = getNextAvailableCol(sheet);

        const headerFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2EFDA' } };
        const borderStyle = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };

        safeMergeHeader(sheet, 1, nextCol, nextCol + 8);
        const nameCell = sheet.getRow(1).getCell(nextCol);
        nameCell.value = productName;
        nameCell.font = { bold: true, size: 12 };
        nameCell.alignment = { horizontal: 'center', vertical: 'middle' };
        
        for (let i = 0; i < 9; i++) {
          const cell = sheet.getRow(1).getCell(nextCol + i);
          cell.fill = headerFill;
          cell.border = borderStyle;
        }
        
        const subHeaders = ['LAST YEAR', 'TOTAL SALE', 'NET SALE', 'TARGET', 'PRICE LIST', 'CN RATE', 'NET RATE', 'TOTAL AMT', 'SR PERCENT'];
        subHeaders.forEach((h, i) => {
          const cell = sheet.getRow(2).getCell(nextCol + i);
          cell.value = h;
          cell.font = { bold: true, size: 10 };
          cell.fill = headerFill;
          cell.border = borderStyle;
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        });

        for (let r = 3; r <= 100; r++) {
          const row = sheet.getRow(r);
          for (let i = 0; i < 9; i++) {
            row.getCell(nextCol + i).border = borderStyle;
          }
        }

        let minPriceRow = -1;
        const totalRows = Math.min(sheet.rowCount + 20, 1000);
        for (let r = 3; r <= totalRows; r++) {
          const rowVal = sheet.getRow(r).getCell(1).value;
          const label = String(rowVal || '').toLowerCase();
          if (label.includes('min') || label.includes('nrv')) {
            minPriceRow = r;
            break;
          }
        }

        if (minPriceRow === -1) {
          minPriceRow = Math.max(sheet.rowCount + 2, 50);
          sheet.getRow(minPriceRow).getCell(1).value = 'Min_Price Config';
        }

        sheet.getRow(minPriceRow).getCell(nextCol).value = `${productName} NRV`;
        sheet.getRow(minPriceRow).getCell(nextCol + 1).value = Number(minPrice);
        sheet.getRow(minPriceRow).getCell(nextCol + 1).font = { bold: true };
      }

      try {
        await workbook.xlsx.writeFile(templatePath);
        results.push(s);
      } catch (writeErr) {
        if (writeErr.code === 'EBUSY' || writeErr.code === 'EPERM') {
          throw new Error('FILE_LOCKED');
        }
        throw writeErr;
      }
    }

    if (results.length === 0) {
      return res.status(404).json({ success: false, message: 'No templates were found to update.' });
    }

    return res.json({ 
      success: true, 
      message: season === 'all' 
        ? `Product "${productName}" added to all seasons.` 
        : `Product "${productName}" added successfully.` 
    });
  } catch (error) {
    console.error('Add product error:', error);
    if (error.message === 'FILE_LOCKED') {
      return res.status(500).json({ success: false, message: 'The Excel file is open in another program. Please close it and try again.' });
    }
    return res.status(500).json({ success: false, message: error.message || 'Operation failed' });
  }
});

/**
 * Dynamically removes a Product block (9 columns) from a Combined template
 */
router.post('/:year/:season/combined/remove-product', async (req, res) => {
  try {
    const { year, season } = req.params;
    const { productName } = req.body;

    if (!productName) {
      return res.status(400).json({ success: false, message: 'Product Name is required' });
    }

    const seasonsToUpdate = season === 'all' ? ['shiyadu', 'unadu', 'chomasu'] : [season];
    const results = [];

    for (const s of seasonsToUpdate) {
      const templatePath = path.join(__dirname, `../../uploads/templates/${year}_${s}_combined_template.xlsx`);
      
      try {
        const st = await fs.stat(templatePath);
        if (st.size === 0) throw new Error('File empty');
      } catch {
        if (season === 'all') continue;
        return res.status(404).json({ success: false, message: `Template for ${s} not found.` });
      }

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(templatePath);

      let removedInThisFile = false;
      for (const sheet of workbook.worksheets) {
        if (sheet.name.startsWith('#')) continue;

        let colToDelete = -1;
        let width = 9;
        const row1 = sheet.getRow(1);
        for (let c = 1; c <= 500; c++) {
          const val = String(row1.getCell(c).value || '').trim();
          if (val.toLowerCase() === productName.toLowerCase()) {
            colToDelete = c;
            if (sheet._merges) {
              const m = sheet._merges[row1.getCell(c).address];
              if (m && m.model) {
                width = m.model.right - m.model.left + 1;
              }
            }
            break;
          }
        }

        if (colToDelete !== -1) {
          convertSharedFormulasToExplicit(sheet);
          safeUnmergeHeader(sheet, 1, colToDelete, colToDelete + width - 1);
          sheet.spliceColumns(colToDelete, width);
          removedInThisFile = true;

          let minPriceRow = -1;
          const totalRows = Math.min(sheet.rowCount + 20, 1000);
          for (let r = 3; r <= totalRows; r++) {
            const rowVal = sheet.getRow(r).getCell(1).value;
            const label = String(rowVal || '').toLowerCase();
            if (label.includes('min') || label.includes('nrv')) {
              minPriceRow = r;
              break;
            }
          }

          if (minPriceRow !== -1) {
            const row = sheet.getRow(minPriceRow);
            for (let c = 3; c <= 500; c += 2) {
              const val = String(row.getCell(c).value || '').trim();
              if (val.toLowerCase().includes(productName.toLowerCase())) {
                row.getCell(c).value = null;
                row.getCell(c + 1).value = null;
                break;
              }
            }
          }
        }
      }

      if (removedInThisFile) {
        try {
          await workbook.xlsx.writeFile(templatePath);
          results.push(s);
        } catch (writeErr) {
          if (writeErr.code === 'EBUSY' || writeErr.code === 'EPERM') {
            throw new Error('FILE_LOCKED');
          }
          throw writeErr;
        }
      }
    }

    if (results.length === 0) {
      return res.status(404).json({ success: false, message: `Product "${productName}" not found in any template.` });
    }

    return res.json({ 
      success: true, 
      message: season === 'all' 
        ? `Product "${productName}" removed from all seasons.` 
        : `Product "${productName}" removed successfully.` 
    });
  } catch (error) {
    console.error('Remove product error:', error);
    if (error.message === 'FILE_LOCKED') {
      return res.status(500).json({ success: false, message: 'The Excel file is open in another program. Please close it and try again.' });
    }
    return res.status(500).json({ success: false, message: error.message || 'Operation failed' });
  }
});

export default router;
