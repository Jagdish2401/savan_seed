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
const EMPLOYEE_BLOCK_HEADERS = ['Dispatch', 'Return', 'Total sales', 'persantage'];

/**
 * Validates Excel template structure
 * @param {string} filePath - Path to uploaded Excel file
 * @returns {Promise<{valid: boolean, error?: string, employeeCount?: number}>}
 */
async function validateTemplateStructure(filePath) {
  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    const sheet = workbook.worksheets[0];

    if (!sheet) {
      return { valid: false, error: 'No worksheet found in the uploaded file.' };
    }

    // Find the header row by searching for "Product" in first column (check rows 1-3)
    let headerRow = null;
    let headerRowNumber = 0;
    for (let row = 1; row <= 3; row++) {
      const firstCell = sheet.getRow(row).getCell(1);
      const firstValue = firstCell.value ? String(firstCell.value).trim().toLowerCase() : '';
      if (firstValue === 'product') {
        headerRow = sheet.getRow(row);
        headerRowNumber = row;
        break;
      }
    }

    if (!headerRow) {
      return { valid: false, error: 'Header row not found. First column should contain "Product".' };
    }

    const headers = [];
    
    // Read up to 100 columns to ensure we get all headers
    const maxCol = Math.max(sheet.columnCount, 100);
    for (let col = 1; col <= maxCol; col++) {
      const cell = headerRow.getCell(col);
      const value = cell.value ? String(cell.value).trim().toLowerCase() : '';
      headers.push(value);
      
      // Stop if we found at least static columns + employee blocks and hit 3+ consecutive empty cells
      if (col > STATIC_COLUMNS.length + 4 && !value && !headers[col - 2] && !headers[col - 3]) {
        break;
      }
    }

    // Remove trailing empty headers
    while (headers.length > 0 && !headers[headers.length - 1]) {
      headers.pop();
    }

    // Check if we have at least the static columns
    if (headers.length < STATIC_COLUMNS.length) {
      return { valid: false, error: `Missing required static columns. Found only ${headers.length} column(s): ${headers.join(', ')}` };
    }

    // Validate static columns (case-insensitive)
    for (let i = 0; i < STATIC_COLUMNS.length; i++) {
      if (headers[i] !== STATIC_COLUMNS[i].toLowerCase()) {
        return { 
          valid: false, 
          error: `Static column mismatch at position ${i + 1}. Expected "${STATIC_COLUMNS[i]}", found "${headerRow.getCell(i+1).value}".` 
        };
      }
    }

    // Validate employee blocks (each block should be 4 columns, case-insensitive)
    let col = STATIC_COLUMNS.length;
    let employeeCount = 0;

    while (col < headers.length) {
      // Check if we have enough columns for a complete block
      if (col + EMPLOYEE_BLOCK_HEADERS.length > headers.length) {
        return { 
          valid: false, 
          error: `Incomplete employee block starting at column ${col + 1}.` 
        };
      }

      // Validate employee block headers
      for (let i = 0; i < EMPLOYEE_BLOCK_HEADERS.length; i++) {
        const expected = EMPLOYEE_BLOCK_HEADERS[i].toLowerCase();
        const actual = headers[col + i];
        
        if (actual !== expected) {
          return { 
            valid: false, 
            error: `Employee block header mismatch at column ${col + i + 1}. Expected "${EMPLOYEE_BLOCK_HEADERS[i]}", found "${headerRow.getCell(col + i + 1).value}".` 
          };
        }
      }

      employeeCount++;
      col += EMPLOYEE_BLOCK_HEADERS.length;
    }

    if (employeeCount === 0) {
      return { valid: false, error: 'No employee blocks found in the template.' };
    }

    return { valid: true, employeeCount };
  } catch (error) {
    console.error('Template validation error:', error);
    return { valid: false, error: `Validation error: ${error.message}` };
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
  const sheet = workbook.worksheets[0];

  if (!sheet) {
    throw new Error('No worksheet found');
  }

  // Find the header row by searching for "Product" in first column (check rows 1-3)
  let headerRowNumber = 1;
  for (let row = 1; row <= 3; row++) {
    const firstCell = sheet.getRow(row).getCell(1);
    const firstValue = firstCell.value ? String(firstCell.value).trim().toLowerCase() : '';
    if (firstValue === 'product') {
      headerRowNumber = row;
      break;
    }
  }

  // Clear data rows (starting after the header row)
  const lastRow = sheet.rowCount;
  for (let rowNum = headerRowNumber + 1; rowNum <= lastRow; rowNum++) {
    const row = sheet.getRow(rowNum);
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      // Only clear if cell doesn't have a formula
      if (!cell.formula) {
        cell.value = null;
      }
    });
  }

  await workbook.xlsx.writeFile(destPath);
}

/**
 * GET /api/templates/:year/:season/:metric/download
 * Download template for a specific season and metric
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
        error: 'Template not found for this season and metric. Please upload a valid template first.' 
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
    const validation = await validateTemplateStructure(uploadedPath);

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

export default router;
