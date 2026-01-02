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

  const headerRow = worksheet.getRow(1);
  const headers = headerRow.values;

  let nameCol = null;
  let percentCol = null;

  for (let col = 1; col < headers.length; col += 1) {
    const h = normalizeHeader(headers[col]);
    if (!nameCol && (h.includes('employee') || h.includes('name'))) nameCol = col;
    if (!percentCol && (h.includes('%') || h.includes('percent') || h.includes('percentage'))) percentCol = col;
  }

  // Fallback: first two columns
  if (!nameCol) nameCol = 1;
  if (!percentCol) percentCol = 2;

  const { detectedYear, detectedYearSource, dateCol, yearCol } = detectYearFromWorksheet(worksheet, headers);

  const agg = new Map(); // name -> { sum, count }

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;

    const rawName = row.getCell(nameCol).value;
    const employeeName = rawName == null ? '' : String(rawName).trim();
    if (!employeeName) return;

    const rawPercent = row.getCell(percentCol).value;
    const percent = parsePercentCell(rawPercent);
    if (percent == null) return;

    const key = employeeName.toLowerCase();
    const prev = agg.get(key) || { employeeName, sum: 0, count: 0 };
    prev.sum += percent;
    prev.count += 1;
    // Keep the original-cased name from first seen row
    agg.set(key, prev);
  });

  const result = new Map(); // normalizedName -> { employeeName, avgPercent }
  for (const [key, { employeeName, sum, count }] of agg.entries()) {
    result.set(key, { employeeName, avgPercent: sum / count });
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
