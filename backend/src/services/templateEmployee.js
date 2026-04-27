import ExcelJS from 'exceljs';
import fs from 'fs/promises';
import path from 'path';

const STATIC_COLS = 3; // Product, Verity, Packing
const NAME_ROW_SCAN_MAX = 3;

function cellToText(cell) {
  const v = cell?.value;
  if (v == null) return '';
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (typeof v === 'object') {
    if (v.text) return String(v.text);
    if (Array.isArray(v.richText)) return v.richText.map((t) => t.text).join('');
    if (v.result != null) return String(v.result);
  }
  return String(v);
}

function colToLetter(col) {
  let n = col;
  let s = '';
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function cloneStyle(obj) {
  if (!obj) return obj;
  // Node 22 has structuredClone; keep fallback safe.
  // eslint-disable-next-line no-undef
  if (typeof structuredClone === 'function') return structuredClone(obj);
  return JSON.parse(JSON.stringify(obj));
}

function findHeaderRowNumber(sheet) {
  for (let r = 1; r <= NAME_ROW_SCAN_MAX; r += 1) {
    const v = cellToText(sheet.getRow(r).getCell(1)).trim().toLowerCase();
    if (v === 'product') return r;
  }
  // Fallback to row 2 (common template layout)
  return 2;
}

function findSavanSeedsStartCol(sheet, nameRowNumber) {
  const row = sheet.getRow(nameRowNumber);
  const maxCol = Math.max(sheet.columnCount || 0, 250);
  for (let c = 1; c <= maxCol; c += 1) {
    const txt = cellToText(row.getCell(c)).trim().toLowerCase();
    if (!txt) continue;
    if (txt.includes('savan') && txt.includes('seed')) return c;
  }
  return null;
}

function findEmployeeAlreadyExists(sheet, nameRowNumber, employeeLabel) {
  const row = sheet.getRow(nameRowNumber);
  const target = employeeLabel.trim().toLowerCase();
  const maxCol = Math.max(sheet.columnCount || 0, 250);
  for (let c = 1; c <= maxCol; c += 1) {
    const txt = cellToText(row.getCell(c)).trim().toLowerCase();
    if (txt && txt === target) return true;
  }
  return false;
}

function buildSumFormula(cols, rowNum) {
  if (!cols.length) return null;
  const args = cols.map((c) => `${colToLetter(c)}${rowNum}`).join(',');
  return `SUM(${args})`;
}

async function insertEmployeeIntoTemplateFile(filePath, employeeLabel) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  
  // Check if sheet already exists
  const existingSheet = workbook.getWorksheet(employeeLabel);
  if (existingSheet) {
    return { updated: false, reason: 'already-exists' };
  }

  // Get the first sheet as a master structure
  const masterSheet = workbook.worksheets[0];
  if (!masterSheet) {
    return { updated: false, reason: 'no-worksheet' };
  }

  // Add a new worksheet and copy structure from master
  // Note: ExcelJS duplicateWorksheet is the cleanest way
  const newSheet = workbook.addWorksheet(employeeLabel);
  
  // Copy columns (widths)
  masterSheet.columns.forEach((col, i) => {
    newSheet.getColumn(i + 1).width = col.width;
  });

  // Copy rows (values, styles, formulas)
  masterSheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    const newRow = newSheet.getRow(rowNumber);
    newRow.height = row.height;
    
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const newCell = newRow.getCell(colNumber);
      
      // Preserve everything for the header rows (usually rows 1 and 2)
      if (rowNumber <= 2) {
        if (cell.formula) {
          const rawFormula = typeof cell.formula === 'object' ? cell.formula.formula : cell.formula;
          newCell.value = { formula: rawFormula, result: cell.result };
        } else {
          newCell.value = cell.value;
        }
      } else {
        // For data rows, preserve formulas but clear values
        if (cell.formula) {
          const rawFormula = typeof cell.formula === 'object' ? cell.formula.formula : cell.formula;
          newCell.value = { formula: rawFormula };
        } else {
          // Keep static info like Product/Verity/Packing in first 3 columns
          if (colNumber <= 3) {
            newCell.value = cell.value;
          } else {
            newCell.value = null; // Clear actual data
          }
        }
      }
      
      // Copy style
      newCell.style = cloneStyle(cell.style);
    });
  });

  // Handle merged cells
  // This is tricky in ExcelJS but we can try to copy them
  const masterMerges = masterSheet._merges; 
  if (masterMerges) {
    for (const mergeKey in masterMerges) {
      try {
        newSheet.mergeCells(masterMerges[mergeKey]);
      } catch (e) {
        // ignore merge errors
      }
    }
  }

  await workbook.xlsx.writeFile(filePath);
  return { updated: true };
}

export async function addEmployeeToAllTemplates({ templatesDir, employeeLabel }) {
  const entries = await fs.readdir(templatesDir, { withFileTypes: true });
  const files = entries
    .filter((e) => e.isFile())
    .map((e) => e.name)
    .filter((n) => n.toLowerCase().endsWith('.xlsx') && n.toLowerCase().includes('_template'));

  let updated = 0;
  let skippedExists = 0;
  let skippedNoSavan = 0;
  let failed = 0;

  for (const name of files) {
    const filePath = path.join(templatesDir, name);
    try {
      const r = await insertEmployeeIntoTemplateFile(filePath, employeeLabel);
      if (r.updated) updated += 1;
      else if (r.reason === 'already-exists') skippedExists += 1;
      else if (r.reason === 'no-savan-seeds') skippedNoSavan += 1;
    } catch {
      failed += 1;
    }
  }

  return { scanned: files.length, updated, skippedExists, skippedNoSavan, failed };
}
