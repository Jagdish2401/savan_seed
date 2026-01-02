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

  // Try wide block format: each employee spans 4 cols: Dispatch, Return, Total sales, Percentage.
  const tryParseWideBlocks = () => {
    // Heuristic: find a row with multiple "dispatch" headers (likely row 2). Scan first 5 rows.
    let headerRowIndex = null;
    for (let r = 1; r <= Math.min(5, worksheet.rowCount || 0); r += 1) {
      const row = worksheet.getRow(r);
      const dispatchCount = row.values.filter((v) => normalizeHeader(v) === 'dispatch').length;
      if (dispatchCount >= 1) {
        headerRowIndex = r;
        break;
      }
    }
    if (!headerRowIndex) return null;

    const headerRow = worksheet.getRow(headerRowIndex);
    const nameRowIndex = headerRowIndex > 1 ? headerRowIndex - 1 : headerRowIndex;
    const nameRow = worksheet.getRow(nameRowIndex);

    const blocks = [];
    const maxCol = headerRow.cellCount || headerRow.actualCellCount || (worksheet.columnCount || 0);
    for (let col = 1; col <= maxCol; col += 1) {
      const h = normalizeHeader(headerRow.getCell(col).value);
      if (h !== 'dispatch') continue;
      const returnH = normalizeHeader(headerRow.getCell(col + 1).value);
      const totalH = normalizeHeader(headerRow.getCell(col + 2).value);
      const percentH = normalizeHeader(headerRow.getCell(col + 3).value);
      if (returnH !== 'return' || !totalH.includes('total') || !isPercentHeader(percentH)) continue;

      const rawName = nameRow.getCell(col).value;
      const employeeName = rawName == null ? `Employee_${blocks.length + 1}` : String(rawName).trim();
      blocks.push({ employeeName, startCol: col, dispatchCol: col, returnCol: col + 1, percentCol: col + 3 });
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

        // Keep both: uploaded percentage cells (may be formula) and computed percent from Dispatch/Return.
        const key = block.employeeName.toLowerCase();
        const prev = agg.get(key) || { employeeName: block.employeeName, values: [], computedValues: [] };
        if (typeof percentFromCell === 'number') prev.values.push(percentFromCell);
        if (typeof percentFromDispatchReturn === 'number' && Number.isFinite(percentFromDispatchReturn)) {
          prev.computedValues.push(percentFromDispatchReturn);
        }
        agg.set(key, prev);
      }
    }

    if (agg.size === 0) return null;

    const employees = new Map();
    for (const [key, { employeeName, values, computedValues }] of agg.entries()) {
      const sourceValues = values.length > 0 ? values : computedValues;
      const avgPercent = sourceValues.reduce((a, b) => a + b, 0) / sourceValues.length;
      employees.set(key, {
        employeeName,
        avgPercent,
        percentValues: values,
        computedPercentValues: computedValues,
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

  // Fallback to narrow format: name + percent columns.
  const headerRow = worksheet.getRow(1);
  const headers = headerRow.values;

  let nameCol = null;
  let percentCol = null;

  for (let col = 1; col < headers.length; col += 1) {
    const h = normalizeHeader(headers[col]);
    if (!nameCol && (h.includes('employee') || h.includes('name'))) nameCol = col;
    if (!percentCol && isPercentHeader(h)) percentCol = col;
  }

  // Fallback: first two columns
  if (!nameCol) nameCol = 1;
  if (!percentCol) percentCol = 2;

  const { detectedYear, detectedYearSource, dateCol, yearCol } = detectYearFromWorksheet(worksheet, headers);

  const agg = new Map(); // name -> { values }

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;

    const rawName = row.getCell(nameCol).value;
    const employeeName = rawName == null ? '' : String(rawName).trim();
    if (!employeeName) return;

    const rawPercent = row.getCell(percentCol).value;
    const percent = parsePercentCell(rawPercent);
    if (percent == null) return;

    const key = employeeName.toLowerCase();
    const prev = agg.get(key) || { employeeName, values: [] };
    prev.values.push(percent);
    // Keep the original-cased name from first seen row
    agg.set(key, prev);
  });

  const result = new Map(); // normalizedName -> { employeeName, avgPercent, percentValues }
  for (const [key, { employeeName, values }] of agg.entries()) {
    const avgPercent = values.reduce((a, b) => a + b, 0) / values.length;
    result.set(key, { employeeName, avgPercent, percentValues: values });
  }

  return {
    nameCol,
    percentCol,
    dateCol,
    yearCol,
    detectedYear,
    detectedYearSource,
    employees: result,
  };
}
