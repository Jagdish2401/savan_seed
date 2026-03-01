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
    // Some files include title rows before the actual header; scan a bit deeper.
    for (let r = 1; r <= Math.min(30, worksheet.rowCount || 0); r += 1) {
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

/**
 * Parse the combined Sales Growth + Sales Return + NRV Excel file.
 *
 * Excel structure:
 *   Row 1: Product names (each product spans 9 columns starting from column C)
 *   Row 2: Headers per product:
 *           LAST YEAR | TOTAL SALE | SALE RETURN | NET SALE |
 *           PRICE (AS PER LIST) | CN RATE | NET RATE | TOTAL AMT | S R PERCENTAGE
 *   Row 3+: Party data — Column A: PARTY NAME (may be blank in templates), Column B: place
 *
 *   After the last party row, Min_Price label + value is found dynamically
 *   inside each product's 9-column block. Detected by scanning the full sheet.
 *
 * Returns: { avgNrvInc, avgSalesGrowthInc, avgSrInc, avgSalesGrowthPct, avgSRPct, products }
 */
function _r(v, d) {
  const f = Math.pow(10, d);
  return Math.round(v * f) / f;
}

function cellStr(raw) {
  if (raw == null) return '';
  if (typeof raw === 'object' && raw.richText) return raw.richText.map(x => x.text).join('');
  if (typeof raw === 'object' && raw.result != null) return String(raw.result);
  if (typeof raw === 'object' && raw.formula) return '';
  return String(raw);
}

/**
 * Parse a single worksheet for the combined Sales/NRV metrics.
 * Returns { avgNrvInc, avgSalesGrowthInc, avgSrInc, avgSalesGrowthPct, avgSRPct, products }
 * or throws if no valid data found.
 */
function parseOneWorksheet(worksheet) {
  const PARTY_COL      = 1; // Column A — party name
  const DATA_START_ROW = 3; // party data starts at row 3
  const maxCol = Math.max(worksheet.columnCount || 0, 30);

  // Helper: normalise a header string for fuzzy matching
  const norm = (s) => cellStr(s).toLowerCase().replace(/[\s_\-().]/g, '');

  // ── STEP 1: Scan Row 2 to find every product block dynamically ────────────
  //
  // Format A (full): LAST YEAR | TOTAL SALE | PRICE LIST | CN RATE | NET RATE | TOTAL AMT | SR%
  //   → a new block starts at each 'lastYear' column
  //
  // Format B (NRV-only / "north" style): NET SALE | PRICE (as per list) | CN (Per Kg) | NET RATE | TOTAL AMT
  //   → no LAST YEAR column; a new block starts at each 'totalSale' ('net sale') column
  //   → SR% is derived as (CN / Price) × 100
  //   → Sales Growth cannot be computed from this file alone (defaults to 0)
  const HEADER_PATTERNS = {
    lastYear:  ['lastyear','lastyrsale','previousyear','prevyear','lastsale'],
    totalSale: ['totalsale','totalsales','netsale','netsales','sale','totals'],
    priceList: ['priceasperllist','priceasperlist','priceperlist','listprice','price'],
    cnRate:    ['cnrateperkg','cnpercent','cnperkg','cnrate','creditnote','cn'],
    netRate:   ['netrate','nrate','net'],
    totalAmt:  ['totalamt','totalamount','amount','amt'],
    srPercent: ['srpercentage','srpercent','sr%','sreturn%','salesreturn%','salesreturnpercent'],
  };

  // Scan Row 2 for all header labels, record col → headerKey
  const row2 = worksheet.getRow(2);
  const colToHeader = new Map(); // col (1-based) → headerKey
  for (let c = 1; c <= maxCol; c++) {
    const label = norm(row2.getCell(c).value);
    if (!label) continue;
    for (const [key, patterns] of Object.entries(HEADER_PATTERNS)) {
      if (patterns.some((p) => label.includes(p) || p.includes(label))) {
        colToHeader.set(c, key);
        break;
      }
    }
  }

  // Collect all found header columns, sorted
  const sortedCols = [...colToHeader.keys()].sort((a, b) => a - b);

  // Determine block-starter key: prefer 'lastYear' (Format A), fall back to 'totalSale' (Format B)
  const lastYearCols  = sortedCols.filter((c) => colToHeader.get(c) === 'lastYear');
  const netSaleCols   = sortedCols.filter((c) => colToHeader.get(c) === 'totalSale');
  const blockStartKey = lastYearCols.length > 0 ? 'lastYear' : 'totalSale';
  const blockStartCols = blockStartKey === 'lastYear' ? lastYearCols : netSaleCols;

  // Build blocks: each block = { startCol, [lastYear], [totalSale], [priceList], [cnRate], [netRate], [totalAmt], [srPercent] }
  const blocks = [];
  for (let i = 0; i < blockStartCols.length; i++) {
    const startCol      = blockStartCols[i];
    const nextStartCol  = blockStartCols[i + 1] ?? (maxCol + 1);
    // Collect all header cols that fall within [startCol, nextStartCol)
    const blockColKeys  = sortedCols
      .filter((c) => c >= startCol && c < nextStartCol)
      .reduce((acc, c) => { acc[colToHeader.get(c)] = c; return acc; }, {});
    blocks.push({ startCol, ...blockColKeys });
  }

  // Fallback: if Row 2 has no recognisable headers, try finding product blocks
  // by scanning Row 1 for non-empty cells and assume fixed 9-col stride from col 3
  if (blocks.length === 0) {
    const BLOCK_SIZE = 9;
    const PRODUCT_START_COL = 3;
    for (let c = PRODUCT_START_COL; c <= maxCol; c += BLOCK_SIZE) {
      // Check Row 1 or 2 within this stride window for any text
      let hasHeader = false;
      for (let ci = c; ci < c + BLOCK_SIZE && ci <= maxCol; ci++) {
        if (cellStr(worksheet.getRow(1).getCell(ci).value).trim() ||
            cellStr(worksheet.getRow(2).getCell(ci).value).trim()) {
          hasHeader = true; break;
        }
      }
      if (!hasHeader) continue;
      blocks.push({
        startCol:  c,
        lastYear:  c,
        totalSale: c + 1,
        priceList: c + 4,
        netRate:   c + 6,
        totalAmt:  c + 7,
        srPercent: c + 8,
      });
    }
  }

  if (blocks.length === 0) {
    throw new Error(
      `Could not detect any product blocks. ` +
      `Row 2 has no recognisable headers (LAST YEAR, NET RATE, TOTAL AMT, etc.). ` +
      `Sheet has ${worksheet.rowCount} rows and ${worksheet.columnCount} cols.`
    );
  }

  // ── STEP 2: Scan entire sheet for Min_Price labels ────────────────────────
  // Map: blockStartCol → min price value
  let firstMinPriceRow = worksheet.rowCount + 1;
  const minPriceByBlockStart = new Map();

  for (let r = DATA_START_ROW; r <= worksheet.rowCount; r++) {
    const row = worksheet.getRow(r);
    for (let c = 1; c <= maxCol; c++) {
      const label = norm(row.getCell(c).value);
      // Accept: "minprice" / "min_price" labels OR any label ending/containing "nrv"
      // (e.g. "Gram NRV", "savan shakti NRV", etc.)
      const isMinPriceLabel =
        label === 'minprice' || label === 'minimumprice' || label === 'min_price' ||
        (label.length >= 3 && label.includes('nrv'));
      if (!isMinPriceLabel) continue;

      // Find which block this column belongs to (nearest block whose startCol <= c)
      let ownerBlock = null;
      for (let bi = 0; bi < blocks.length; bi++) {
        const nextBlockStart = blocks[bi + 1]?.startCol ?? (maxCol + 1);
        if (c >= blocks[bi].startCol && c < nextBlockStart) { ownerBlock = blocks[bi]; break; }
      }
      // Value is in the very next column after the label
      const val = parseNumberCell(row.getCell(c + 1).value);
      if (ownerBlock && val != null && val > 0 && !minPriceByBlockStart.has(ownerBlock.startCol)) {
        minPriceByBlockStart.set(ownerBlock.startCol, val);
      }
      if (r < firstMinPriceRow) firstMinPriceRow = r;
    }
  }

  // ── STEP 3: Determine last party data row ────────────────────────────────
  let lastPartyRow = DATA_START_ROW - 1;

  // Primary: last non-empty Col A (party name column)
  for (let r = DATA_START_ROW; r < firstMinPriceRow; r++) {
    if (cellStr(worksheet.getRow(r).getCell(PARTY_COL).value).trim() !== '') {
      lastPartyRow = r;
    }
  }

  // Fallback: Col A is blank (template) — go backwards from Min_Price row
  if (lastPartyRow < DATA_START_ROW && firstMinPriceRow > DATA_START_ROW) {
    lastPartyRow = firstMinPriceRow - 1;
    while (lastPartyRow >= DATA_START_ROW) {
      const row = worksheet.getRow(lastPartyRow);
      let hasAny = false;
      for (const bl of blocks) {
        for (const colKey of ['lastYear', 'totalSale', 'netRate', 'totalAmt']) {
          if (bl[colKey]) {
            const v = parseNumberCell(row.getCell(bl[colKey]).value);
            if (v != null && v !== 0) { hasAny = true; break; }
          }
        }
        if (hasAny) break;
      }
      if (hasAny) break;
      lastPartyRow--;
    }
  }

  // Last resort: everything before Min_Price
  if (lastPartyRow < DATA_START_ROW) {
    lastPartyRow = firstMinPriceRow > DATA_START_ROW ? firstMinPriceRow - 1 : worksheet.rowCount;
  }

  // ── STEP 4: Aggregate per product block ──────────────────────────────────
  const productResults = [];

  for (let bi = 0; bi < blocks.length; bi++) {
    const bl = blocks[bi];

    // Product name: find the first non-empty cell in Row 1 from this block's
    // startCol up to (but not including) the next block's startCol
    const nextStart = blocks[bi + 1]?.startCol ?? (maxCol + 1);
    let productName = '';
    for (let c = bl.startCol; c < nextStart && c <= maxCol; c++) {
      const txt = cellStr(worksheet.getRow(1).getCell(c).value).trim();
      if (txt) { productName = txt; break; }
    }

    // Min_Price for this block
    const minPrice = minPriceByBlockStart.get(bl.startCol) ?? null;

    let sumNetRate   = 0;
    let sumLastYear  = 0;
    let sumTotalAmt  = 0;
    let sumSRPercent = 0;
    let srCount      = 0;
    let priceListVal = null;
    let partyCount   = 0;

    for (let r = DATA_START_ROW; r <= lastPartyRow; r++) {
      const row = worksheet.getRow(r);

      const lastYear  = bl.lastYear  ? parseNumberCell(row.getCell(bl.lastYear).value)  : null;
      const totalSale = bl.totalSale ? parseNumberCell(row.getCell(bl.totalSale).value) : null;
      const netRate   = bl.netRate   ? parseNumberCell(row.getCell(bl.netRate).value)   : null;
      const totalAmt  = bl.totalAmt  ? parseNumberCell(row.getCell(bl.totalAmt).value)  : null;

      // Skip blank / zero-only template rows
      const hasData = (lastYear  != null && lastYear  > 0) ||
                      (totalSale != null && totalSale > 0) ||
                      (totalAmt  != null && totalAmt  > 0) ||
                      (netRate   != null && netRate   > 0);
      if (!hasData) {
        if (priceListVal == null && bl.priceList) {
          const pv = parseNumberCell(row.getCell(bl.priceList).value);
          if (pv != null && pv > 0) priceListVal = pv;
        }
        continue;
      }

      const pList = bl.priceList ? parseNumberCell(row.getCell(bl.priceList).value) : null;
      const cn    = bl.cnRate    ? parseNumberCell(row.getCell(bl.cnRate).value)    : null;

      // SR%: use explicit column if available, else derive from CN/Price ratio (Format B)
      const srPct = bl.srPercent
        ? parseNumberCell(row.getCell(bl.srPercent).value)
        : (cn != null && pList != null && pList > 0)
          ? (cn / pList) * 100
          : null;

      if (netRate  != null) sumNetRate  += netRate;
      if (lastYear != null) sumLastYear += lastYear;
      if (totalAmt != null) sumTotalAmt += totalAmt;
      if (srPct    != null) { sumSRPercent += srPct; srCount++; }
      if (pList    != null && priceListVal == null) priceListVal = pList;
      partyCount++;
    }

    if (partyCount === 0 && sumTotalAmt === 0 && sumLastYear === 0) continue;

    const avgNetRate   = partyCount > 0 ? sumNetRate / partyCount : 0;
    const avgSRPercent = srCount > 0 ? sumSRPercent / srCount : 0;

    // NRV Increment (0–18): compare avg net rate against min price and list price
    // null means min price was not configured — skip this product from NRV averaging
    let nrvInc = null;
    if (minPrice != null && priceListVal != null && priceListVal > minPrice) {
      let v = 0;
      if      (avgNetRate <= minPrice)      v = 0;
      else if (avgNetRate >= priceListVal)  v = 18;
      else v = ((avgNetRate - minPrice) / (priceListVal - minPrice)) * 18;
      nrvInc = Math.max(0, Math.min(18, v));
    }

    // Sales Growth % → Increment (0–36)
    let salesGrowthPercent = 0;
    if (sumLastYear > 0) salesGrowthPercent = ((sumTotalAmt - sumLastYear) / sumLastYear) * 100;
    let salesGrowthInc = salesGrowthPercent <= 0 ? 0
      : salesGrowthPercent >= 200 ? 36
      : (salesGrowthPercent / 200) * 36;
    salesGrowthInc = Math.max(0, Math.min(36, salesGrowthInc));

    // SR Increment (0–18): lower SR% = higher increment
    let srInc = avgSRPercent <= 0 ? 18 : avgSRPercent >= 18 ? 0 : 18 - avgSRPercent;
    srInc = Math.max(0, Math.min(18, srInc));

    productResults.push({
      productName:        productName || `Product_${bi + 1}`,
      partyCount,
      minPrice,
      minPriceMissing:    minPrice == null,
      priceListVal,
      avgNetRate:         _r(avgNetRate, 2),
      sumLastYear:        _r(sumLastYear, 2),
      sumTotalAmt:        _r(sumTotalAmt, 2),
      avgSRPercent:       _r(avgSRPercent, 4),
      nrvInc:             nrvInc == null ? null : _r(nrvInc, 4),
      salesGrowthPercent: _r(salesGrowthPercent, 4),
      salesGrowthInc:     _r(salesGrowthInc, 4),
      srInc:              _r(srInc, 4),
    });
  }

  if (productResults.length === 0) {
    // Build diagnostic: show what Row 2 headers were found
    const foundHeaders = [...colToHeader.entries()].map(([c, k]) => `col${c}=${k}`).join(', ');
    throw new Error(
      `No valid product data found after scanning ${blocks.length} block(s). ` +
      `Row 2 headers detected: [${foundHeaders || 'none'}]. ` +
      `Sheet: ${worksheet.rowCount} rows × ${worksheet.columnCount} cols. ` +
      `Ensure at least one party row has LAST YEAR, TOTAL AMT or NET RATE > 0.`
    );
  }

  const n = productResults.length;

  // NRV avg: only count products that actually had a minPrice configured
  const nrvProducts         = productResults.filter((p) => p.nrvInc != null);
  const noMinPriceProducts  = productResults.filter((p) => p.minPriceMissing).map((p) => p.productName);
  const avgNrvInc           = nrvProducts.length > 0
    ? nrvProducts.reduce((a, p) => a + p.nrvInc, 0) / nrvProducts.length
    : 0; // if ALL products lack minPrice, NRV inc = 0

  const avgSalesGrowthInc = productResults.reduce((a, p) => a + p.salesGrowthInc, 0)     / n;
  const avgSrInc          = productResults.reduce((a, p) => a + p.srInc, 0)              / n;
  const avgSalesGrowthPct = productResults.reduce((a, p) => a + p.salesGrowthPercent, 0) / n;
  const avgSRPct          = productResults.reduce((a, p) => a + p.avgSRPercent, 0)       / n;

  return {
    avgNrvInc:          _r(avgNrvInc, 2),
    avgSalesGrowthInc:  _r(avgSalesGrowthInc, 2),
    avgSrInc:           _r(avgSrInc, 2),
    avgSalesGrowthPct:  _r(avgSalesGrowthPct, 2),
    avgSRPct:           _r(avgSRPct, 2),
    noMinPriceProducts,   // products where min price was not set in the sheet
    lastPartyRow,
    firstMinPriceRow,
    products:           productResults,
  };
}

/**
 * Parse a combined Sales Growth + Sales Return + NRV Excel file
 * that contains ONE SHEET PER EMPLOYEE (sheet name = employee name).
 *
 * Returns an array:
 *   [{ employeeName, avgNrvInc, avgSalesGrowthInc, avgSrInc, avgSalesGrowthPct, avgSRPct, products }, ...]
 *
 * Sheets whose name starts with '#' or whose name is blank are skipped.
 * If a sheet has no valid product data it is also skipped (with a warning), not thrown.
 */
export async function parseCombinedSalesNrvExcel(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  if (!workbook.worksheets.length) {
    throw new Error('No worksheets found in Excel file');
  }

  const results = [];
  const errors  = [];

  for (const worksheet of workbook.worksheets) {
    const sheetName = (worksheet.name || '').trim();
    // Skip helper/hidden sheets named starting with # or empty names
    if (!sheetName || sheetName.startsWith('#')) continue;

    try {
      const metrics = parseOneWorksheet(worksheet);
      results.push({ employeeName: sheetName, ...metrics });
    } catch (err) {
      // Record the error but keep processing other sheets
      errors.push({ sheet: sheetName, error: err.message });
    }
  }

  if (results.length === 0) {
    const detail = errors.length
      ? errors.map((e) => `${e.sheet}: ${e.error}`).join('; ')
      : 'No sheets with valid data';
    throw new Error(`No valid employee data found in Excel. ${detail}`);
  }

  return { employees: results, errors };
}
