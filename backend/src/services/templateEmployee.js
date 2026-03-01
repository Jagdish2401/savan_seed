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
  const sheet = workbook.worksheets[0];
  if (!sheet) return { updated: false, reason: 'no-worksheet' };

  const headerRowNumber = findHeaderRowNumber(sheet);
  const nameRowNumber = Math.max(1, headerRowNumber - 1);

  const savanStartBefore = findSavanSeedsStartCol(sheet, nameRowNumber);
  if (!savanStartBefore) return { updated: false, reason: 'no-savan-seeds' };

  if (findEmployeeAlreadyExists(sheet, nameRowNumber, employeeLabel)) {
    return { updated: false, reason: 'already-exists' };
  }

  const rowCount = Math.max(sheet.rowCount || 0, headerRowNumber + 1);
  const emptyCol = new Array(rowCount).fill(null);

  // Insert 4 columns before SAVAN SEEDS block
  sheet.spliceColumns(savanStartBefore, 0, emptyCol, emptyCol, emptyCol, emptyCol);

  // After insertion, SAVAN SEEDS shifts right by 4
  const savanStart = savanStartBefore + 4;

  // Copy widths + styles from the employee block immediately before insertion point
  const refStart = savanStartBefore - 4;
  if (refStart >= STATIC_COLS + 1) {
    for (let i = 0; i < 4; i += 1) {
      const srcCol = sheet.getColumn(refStart + i);
      const dstCol = sheet.getColumn(savanStartBefore + i);
      dstCol.width = srcCol.width;
    }

    for (let r = 1; r <= sheet.rowCount; r += 1) {
      const row = sheet.getRow(r);
      for (let i = 0; i < 4; i += 1) {
        const src = row.getCell(refStart + i);
        const dst = row.getCell(savanStartBefore + i);
        dst.value = dst.value ?? null;
        dst.style = cloneStyle(src.style);
        dst.numFmt = src.numFmt;
      }
    }
  }

  // Employee name merged cell in name row
  try {
    sheet.mergeCells(nameRowNumber, savanStartBefore, nameRowNumber, savanStartBefore + 3);
  } catch {
    // ignore merge conflicts
  }
  sheet.getRow(nameRowNumber).getCell(savanStartBefore).value = employeeLabel;

  // Header row values: copy from previous employee block headers if possible; otherwise set defaults
  for (let i = 0; i < 4; i += 1) {
    const dst = sheet.getRow(headerRowNumber).getCell(savanStartBefore + i);
    const src = refStart >= 1 ? sheet.getRow(headerRowNumber).getCell(refStart + i) : null;
    const srcVal = src ? src.value : null;
    dst.value = srcVal ?? (i === 0 ? 'Dispatch' : i === 1 ? 'Return' : i === 2 ? 'Total sales' : 'Persantage');
  }

  // Ensure SAVAN SEEDS block formulas include this new employee by recalculating totals.
  // Dispatch/Return sums are across ALL employee blocks before SAVAN SEEDS.
  const dispatchCols = [];
  const returnCols = [];
  for (let c = STATIC_COLS + 1; c < savanStart; c += 4) {
    dispatchCols.push(c);
    returnCols.push(c + 1);
  }

  for (let r = headerRowNumber + 1; r <= sheet.rowCount; r += 1) {
    const dispatchFormula = buildSumFormula(dispatchCols, r);
    const returnFormula = buildSumFormula(returnCols, r);

    const dispatchCell = `${colToLetter(savanStart)}${r}`;
    const returnCell = `${colToLetter(savanStart + 1)}${r}`;

    if (dispatchFormula) sheet.getRow(r).getCell(savanStart).value = { formula: dispatchFormula };
    if (returnFormula) sheet.getRow(r).getCell(savanStart + 1).value = { formula: returnFormula };

    sheet.getRow(r).getCell(savanStart + 2).value = { formula: `${dispatchCell}-${returnCell}` };
    sheet.getRow(r).getCell(savanStart + 3).value = {
      formula: `IF(${dispatchCell}=0,0,${returnCell}/${dispatchCell}*100)`,
    };
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
