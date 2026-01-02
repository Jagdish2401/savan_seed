import ExcelJS from 'exceljs';

function normalizeHeader(header) {
  if (header == null) return '';
  return String(header).trim().toLowerCase();
}

function parsePercentCell(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'number') return value;
  const cleaned = String(value).trim().replace('%', '');
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

function isPercentHeader(h) {
  // Accept common spellings and frequent typos like "persantage"/"persantge"
  return h.includes('%') || h.includes('percent') || h.includes('persan');
}

function parseNumberCell(value) {
  const v = unwrapCellValue(value);
  if (v == null || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const n = Number.parseFloat(String(v).trim());
  return Number.isFinite(n) ? n : null;
}

function unwrapCellValue(v) {
  if (v == null) return null;
  if (v instanceof Date) return v;
  if (typeof v === 'number' || typeof v === 'string') return v;
  if (typeof v === 'object') {
    if (v.text != null) return v.text;
    if (v.result != null) return v.result;
    if (v.richText && Array.isArray(v.richText)) {
      return v.richText.map((x) => x.text).join('');
    }
  }
  return v;
}

function excelSerialToDate(serial) {
  if (typeof serial !== 'number' || !Number.isFinite(serial)) return null;
  // Excel (Windows) serial date: days since 1899-12-30.
  // 25569 is days between 1899-12-30 and 1970-01-01.
  const utcMs = Math.round((serial - 25569) * 86400 * 1000);
  const d = new Date(utcMs);
  return Number.isFinite(d.getTime()) ? d : null;
}

function parseYearFromCellValue(raw) {
  const v = unwrapCellValue(raw);
  if (v == null || v === '') return null;

  if (v instanceof Date) {
    const y = v.getFullYear();
    return Number.isInteger(y) ? y : null;
  }

  if (typeof v === 'number') {
    // Could be an Excel serial date OR a plain year.
    if (v >= 1900 && v <= 3000 && Number.isInteger(v)) return v;
    const d = excelSerialToDate(v);
    if (!d) return null;
    const y = d.getFullYear();
    return Number.isInteger(y) ? y : null;
  }

  const s = String(v).trim();
  if (!s) return null;
  if (/^\d{4}$/.test(s)) {
    const y = Number(s);
    return y >= 1900 && y <= 3000 ? y : null;
  }

  const parsed = Date.parse(s);
  if (Number.isFinite(parsed)) {
    const y = new Date(parsed).getFullYear();
    return Number.isInteger(y) ? y : null;
  }

  return null;
}

function detectYearFromWorksheet(worksheet, headers) {
  let dateCol = null;
  let yearCol = null;

  for (let col = 1; col < headers.length; col += 1) {
    const h = normalizeHeader(headers[col]);
    if (!dateCol && h.includes('date')) dateCol = col;
    if (!yearCol && (h === 'year' || h.includes(' year') || h.startsWith('year') || h === 'yr')) yearCol = col;
  }

  const colToUse = dateCol || yearCol;
  if (!colToUse) {
    return { detectedYear: null, detectedYearSource: null, dateCol: null, yearCol: null };
  }

  const seen = new Map(); // year -> count
  const maxScan = Math.min(worksheet.rowCount || 0, 50);
  for (let r = 2; r <= maxScan; r += 1) {
    const row = worksheet.getRow(r);
    const y = parseYearFromCellValue(row.getCell(colToUse).value);
    if (y == null) continue;
    seen.set(y, (seen.get(y) || 0) + 1);
  }

  if (seen.size === 0) {
    return {
      detectedYear: null,
      detectedYearSource: dateCol ? `dateCol:${colToUse}` : `yearCol:${colToUse}`,
      dateCol,
      yearCol,
    };
  }

  let bestYear = null;
  let bestCount = -1;
  for (const [y, count] of seen.entries()) {
    if (count > bestCount) {
      bestYear = y;
      bestCount = count;
    }
  }

  const headerName = normalizeHeader(headers[colToUse]);
  const sourceLabel = headerName ? `column:${headerName}` : `column:${colToUse}`;
  return { detectedYear: bestYear, detectedYearSource: sourceLabel, dateCol, yearCol };
}

export async function parseEmployeePercentAveragesFromXlsxBuffer(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error('No worksheet found in Excel file');
  }

  // Try wide block format: each employee spans a 4-column block and the last column is Percentage.
  const tryParseWideBlocks = () => {
    // Heuristic: find the header row that contains the most "percentage" headers.
    // This lets us support different column names for the first 3 columns.
    let headerRowIndex = null;
    let bestPercentCount = 0;
    for (let r = 1; r <= Math.min(10, worksheet.rowCount || 0); r += 1) {
      const row = worksheet.getRow(r);
      const percentCount = row.values.filter((v) => isPercentHeader(normalizeHeader(v))).length;
      if (percentCount > bestPercentCount) {
        bestPercentCount = percentCount;
        headerRowIndex = r;
      }
    }
    if (!headerRowIndex || bestPercentCount === 0) return null;

    const headerRow = worksheet.getRow(headerRowIndex);
    const nameRowIndex = headerRowIndex > 1 ? headerRowIndex - 1 : headerRowIndex;
    const nameRow = worksheet.getRow(nameRowIndex);

    const blocks = [];
    const maxCol = headerRow.cellCount || headerRow.actualCellCount || (worksheet.columnCount || 0);
    for (let percentCol = 1; percentCol <= maxCol; percentCol += 1) {
      const percentH = normalizeHeader(headerRow.getCell(percentCol).value);
      if (!isPercentHeader(percentH)) continue;

      const startCol = percentCol - 3;
      if (startCol < 1) continue;

      const rawName = nameRow.getCell(startCol).value;
      const employeeName = rawName == null ? `Employee_${blocks.length + 1}` : String(rawName).trim();
      blocks.push({
        employeeName,
        startCol,
        dispatchCol: startCol,
        returnCol: startCol + 1,
        percentCol,
      });
    }

    if (blocks.length === 0) return null;

    const agg = new Map();
    const startDataRow = headerRowIndex + 1;
    for (let r = startDataRow; r <= worksheet.rowCount; r += 1) {
      const row = worksheet.getRow(r);
      for (const block of blocks) {
        const percentFromCell = parsePercentCell(unwrapCellValue(row.getCell(block.percentCol).value));
        const dispatch = parseNumberCell(row.getCell(block.dispatchCol).value);
        const ret = parseNumberCell(row.getCell(block.returnCol).value);
        const percentFromDispatchReturn =
          typeof dispatch === 'number' && dispatch > 0 && typeof ret === 'number' ? (ret / dispatch) * 100 : null;

        // Per-row effective %: prefer Percentage cell (already calculated in Excel).
        // If Excel formula result isn't available, fall back to Return/Dispatch.
        const effectivePercent = typeof percentFromCell === 'number' ? percentFromCell : percentFromDispatchReturn;

        // Keep both sources + effective (row-by-row).
        const key = block.employeeName.toLowerCase();
        const prev = agg.get(key) || {
          employeeName: block.employeeName,
          values: [],
          computedValues: [],
          effectiveValues: [],
        };
        if (typeof percentFromCell === 'number') prev.values.push(percentFromCell);
        if (typeof percentFromDispatchReturn === 'number' && Number.isFinite(percentFromDispatchReturn)) {
          prev.computedValues.push(percentFromDispatchReturn);
        }
        if (typeof effectivePercent === 'number' && Number.isFinite(effectivePercent)) {
          prev.effectiveValues.push(effectivePercent);
        }
        agg.set(key, prev);
      }
    }

    if (agg.size === 0) return null;

    const employees = new Map();
    for (const [key, { employeeName, values, computedValues, effectiveValues }] of agg.entries()) {
      const sourceValues = effectiveValues.length > 0 ? effectiveValues : (values.length > 0 ? values : computedValues);
      const avgPercent = sourceValues.reduce((a, b) => a + b, 0) / sourceValues.length;
      employees.set(key, {
        employeeName,
        avgPercent,
        percentValues: values,
        computedPercentValues: computedValues,
        effectivePercentValues: effectiveValues,
      });
    }

    return {
      format: 'wide',
      nameCol: null,
      percentCol: null,
      dateCol: null,
      yearCol: null,
      detectedYear: null,
      detectedYearSource: null,
      employees,
    };
  };

  const wide = tryParseWideBlocks();
  if (wide) return wide;

  throw new Error('Unsupported Excel format: expected 4-column employee blocks ending with Percentage');
}
