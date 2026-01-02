import * as XLSX from 'xlsx-js-style';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

function safeFilePart(s) {
  return String(s)
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_\-]/g, '')
    .slice(0, 80);
}

function safeSheetName(s) {
  const raw = String(s || 'Sheet1').trim();
  // Excel sheet name rules: max 31 chars; disallow: : \ / ? * [ ]
  return raw
    .replace(/[:\\/?*\[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .slice(0, 31) || 'Sheet1';
}

function toCellString(v) {
  if (v == null) return '';
  return String(v);
}

function computeColWidths(aoa) {
  const colCount = Math.max(...aoa.map((r) => r.length));
  const widths = Array.from({ length: colCount }, () => 10);

  for (let c = 0; c < colCount; c += 1) {
    let maxLen = 0;
    for (let r = 0; r < aoa.length; r += 1) {
      const cell = aoa[r]?.[c];
      const len = toCellString(cell).length;
      if (len > maxLen) maxLen = len;
    }
    // Reasonable bounds so sheets look good.
    widths[c] = Math.max(10, Math.min(40, maxLen + 2));
  }

  return widths.map((wch) => ({ wch }));
}

const HEADER_STYLE = {
  font: { bold: true, color: { rgb: '000000' } },
  fill: { patternType: 'solid', fgColor: { rgb: 'FFEB3B' } },
  alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
  border: {
    top: { style: 'thin', color: { rgb: 'BDBDBD' } },
    bottom: { style: 'thin', color: { rgb: 'BDBDBD' } },
    left: { style: 'thin', color: { rgb: 'BDBDBD' } },
    right: { style: 'thin', color: { rgb: 'BDBDBD' } },
  },
};

const GRID_BORDER = {
  top: { style: 'thin', color: { rgb: 'BDBDBD' } },
  bottom: { style: 'thin', color: { rgb: 'BDBDBD' } },
  left: { style: 'thin', color: { rgb: 'BDBDBD' } },
  right: { style: 'thin', color: { rgb: 'BDBDBD' } },
};

const DATA_STYLE = {
  alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
  border: GRID_BORDER,
};

const EMPLOYEE_STYLE = {
  font: { bold: true, color: { rgb: '2563EB' } },
  alignment: { horizontal: 'left', vertical: 'center', wrapText: true },
  border: GRID_BORDER,
};

const SECTION_TITLE_STYLE = {
  font: { bold: true, color: { rgb: '000000' } },
  fill: { patternType: 'solid', fgColor: { rgb: 'F3F4F6' } },
  alignment: { horizontal: 'left', vertical: 'center', wrapText: true },
  border: GRID_BORDER,
};

function mergeCellStyle(cell, nextStyle) {
  if (!cell) return;
  const prev = cell.s || {};
  cell.s = {
    ...prev,
    ...nextStyle,
    font: { ...(prev.font || {}), ...(nextStyle.font || {}) },
    alignment: { ...(prev.alignment || {}), ...(nextStyle.alignment || {}) },
    fill: nextStyle.fill || prev.fill,
    border: nextStyle.border || prev.border,
  };
}

export function downloadExcel({ filenameBase, sheetName, columns, rows }) {
  const headerRow = columns.map((c) => c.header);
  const dataRows = rows.map((r) => columns.map((c) => (c.value ? c.value(r) : r?.[c.key])));

  const aoa = [headerRow, ...dataRows];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = computeColWidths(aoa);

  // Improve usability in Excel: freeze header row + enable filter.
  try {
    ws['!freeze'] = { xSplit: 0, ySplit: 1, topLeftCell: 'A2', activePane: 'bottomLeft', state: 'frozen' };
  } catch {
    // Non-fatal: some readers may ignore these properties.
  }

  // Styling (via xlsx-js-style): yellow header row + Employee column emphasis.
  try {
    if (ws['!ref']) {
      const range = XLSX.utils.decode_range(ws['!ref']);
      for (let c = range.s.c; c <= range.e.c; c += 1) {
        const addr = XLSX.utils.encode_cell({ c, r: 0 });
        if (ws[addr]) ws[addr].s = HEADER_STYLE;
      }

      // Employee column assumed to be first column.
      for (let r = 1; r <= range.e.r; r += 1) {
        const addr = XLSX.utils.encode_cell({ c: 0, r });
        if (ws[addr]) ws[addr].s = EMPLOYEE_STYLE;
      }
    }
  } catch {
    // Non-fatal.
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, safeSheetName(sheetName));

  const file = `${safeFilePart(filenameBase || 'export')}.xlsx`;
  XLSX.writeFile(wb, file);
}

function buildWorksheet({ columns, rows }) {
  const headerRow = columns.map((c) => c.header);
  const dataRows = rows.map((r) => columns.map((c) => (c.value ? c.value(r) : r?.[c.key])));
  const aoa = [headerRow, ...dataRows];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = computeColWidths(aoa);

  try {
    ws['!freeze'] = { xSplit: 0, ySplit: 1, topLeftCell: 'A2', activePane: 'bottomLeft', state: 'frozen' };
  } catch {
    // ignore
  }

  // Styling (yellow header + bold employee column)
  try {
    if (ws['!ref']) {
      const range = XLSX.utils.decode_range(ws['!ref']);
      for (let c = range.s.c; c <= range.e.c; c += 1) {
        const addr = XLSX.utils.encode_cell({ c, r: 0 });
        if (ws[addr]) ws[addr].s = HEADER_STYLE;
      }
      for (let r = 1; r <= range.e.r; r += 1) {
        const addr = XLSX.utils.encode_cell({ c: 0, r });
        if (ws[addr]) ws[addr].s = EMPLOYEE_STYLE;
      }

      // Apply grid borders + alignment to data cells
      for (let r = 1; r <= range.e.r; r += 1) {
        for (let c = range.s.c; c <= range.e.c; c += 1) {
          const addr = XLSX.utils.encode_cell({ c, r });
          if (!ws[addr]) continue;
          if (c === 0) {
            mergeCellStyle(ws[addr], EMPLOYEE_STYLE);
          } else {
            mergeCellStyle(ws[addr], DATA_STYLE);
          }
        }
      }
    }
  } catch {
    // ignore
  }

  return ws;
}

function buildSectionedWorksheet({ blocks }) {
  const aoa = [];
  const headerRowIdxs = [];
  const titleRowMeta = []; // { rowIdx, colCount }
  const employeeCellAddrs = []; // { r, c }
  const headerRowIndexSet = new Set();
  const titleRowIndexSet = new Set();

  for (const block of blocks || []) {
    const columns = block.columns || [];
    const rows = block.rows || [];
    const colCount = Math.max(1, columns.length);

    // Section title row
    const titleRowIdx = aoa.length;
    const titleRow = [String(block.title || '')];
    while (titleRow.length < colCount) titleRow.push('');
    aoa.push(titleRow);
    titleRowMeta.push({ rowIdx: titleRowIdx, colCount });
    titleRowIndexSet.add(titleRowIdx);

    // Header row
    const headerRowIdx = aoa.length;
    const headerRow = columns.map((c) => c.header);
    while (headerRow.length < colCount) headerRow.push('');
    aoa.push(headerRow);
    headerRowIdxs.push({ rowIdx: headerRowIdx, colCount });
    headerRowIndexSet.add(headerRowIdx);

    // Data rows
    for (const r of rows) {
      const dataRowIdx = aoa.length;
      const rowVals = columns.map((c) => (c.value ? c.value(r) : r?.[c.key]));
      while (rowVals.length < colCount) rowVals.push('');
      aoa.push(rowVals);
      employeeCellAddrs.push({ r: dataRowIdx, c: 0 });
    }

    // Blank separator row
    aoa.push([]);
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = computeColWidths(aoa);

  // Merge title row across section width + style
  try {
    ws['!merges'] = ws['!merges'] || [];
    for (const m of titleRowMeta) {
      ws['!merges'].push({ s: { r: m.rowIdx, c: 0 }, e: { r: m.rowIdx, c: m.colCount - 1 } });
      const addr = XLSX.utils.encode_cell({ r: m.rowIdx, c: 0 });
      if (ws[addr]) ws[addr].s = SECTION_TITLE_STYLE;
    }
  } catch {
    // ignore
  }

  // Style headers
  try {
    for (const h of headerRowIdxs) {
      for (let c = 0; c < h.colCount; c += 1) {
        const addr = XLSX.utils.encode_cell({ r: h.rowIdx, c });
        if (ws[addr]) ws[addr].s = HEADER_STYLE;
      }
    }
  } catch {
    // ignore
  }

  // Style employee column
  try {
    for (const p of employeeCellAddrs) {
      const addr = XLSX.utils.encode_cell({ r: p.r, c: p.c });
      if (ws[addr]) ws[addr].s = EMPLOYEE_STYLE;
    }
  } catch {
    // ignore
  }

  // Apply grid borders + alignment to all used cells (excluding header/title which already styled)
  try {
    if (ws['!ref']) {
      const range = XLSX.utils.decode_range(ws['!ref']);
      for (let r = range.s.r; r <= range.e.r; r += 1) {
        if (headerRowIndexSet.has(r) || titleRowIndexSet.has(r)) continue;
        for (let c = range.s.c; c <= range.e.c; c += 1) {
          const addr = XLSX.utils.encode_cell({ r, c });
          if (!ws[addr]) continue;
          if (c === 0) {
            mergeCellStyle(ws[addr], EMPLOYEE_STYLE);
          } else {
            mergeCellStyle(ws[addr], DATA_STYLE);
          }
        }
      }
    }
  } catch {
    // ignore
  }

  return ws;
}

export function downloadExcelWorkbookMixed({ filenameBase, sheets }) {
  const wb = XLSX.utils.book_new();
  for (const s of sheets || []) {
    const ws = Array.isArray(s.blocks)
      ? buildSectionedWorksheet({ blocks: s.blocks })
      : buildWorksheet({ columns: s.columns, rows: s.rows });
    XLSX.utils.book_append_sheet(wb, ws, safeSheetName(s.sheetName));
  }
  const file = `${safeFilePart(filenameBase || 'export')}.xlsx`;
  XLSX.writeFile(wb, file);
}

export function downloadPdfSections({ filenameBase, title, subtitle, sections }) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 40;

  doc.setFontSize(14);
  doc.text(String(title || 'Export'), marginX, 40);
  let cursorY = 60;
  if (subtitle) {
    doc.setFontSize(10);
    doc.setTextColor(90);
    doc.text(String(subtitle), marginX, 58);
    doc.setTextColor(0);
    cursorY = 75;
  }

  for (const sec of sections) {
    if (cursorY > 520) {
      doc.addPage();
      cursorY = 50;
    }

    doc.setFontSize(12);
    doc.text(String(sec.title || ''), marginX, cursorY);
    cursorY += 10;

    if (sec.subtitle) {
      doc.setFontSize(9);
      doc.setTextColor(90);
      doc.text(String(sec.subtitle), marginX, cursorY);
      doc.setTextColor(0);
      cursorY += 10;
    } else {
      cursorY += 6;
    }

    const colCount = sec.columns?.length || 0;
    const dense = colCount >= 10;

    autoTable(doc, {
      startY: cursorY,
      head: [sec.columns.map((c) => c.header)],
      body: sec.rows.map((r) => sec.columns.map((c) => (c.value ? c.value(r) : r?.[c.key]))),
      styles: {
        fontSize: dense ? 7 : 9,
        cellPadding: dense ? 2 : 4,
        overflow: 'linebreak',
        cellWidth: 'wrap',
        valign: 'middle',
      },
      headStyles: {
        fillColor: [255, 235, 59],
        textColor: 0,
        fontStyle: 'bold',
        fontSize: dense ? 7 : 9,
        halign: 'center',
        valign: 'middle',
      },
      columnStyles: {
        0: {
          fontStyle: 'bold',
          textColor: [37, 99, 235],
          halign: 'left',
          cellWidth: dense ? 140 : 180,
        },
      },
      margin: { left: marginX, right: marginX },
      tableWidth: pageWidth - marginX * 2,
    });

    cursorY = (doc.lastAutoTable?.finalY || cursorY) + 20;
  }

  const file = `${safeFilePart(filenameBase || 'export')}.pdf`;
  doc.save(file);
}

export function downloadPdf({ filenameBase, title, subtitle, columns, rows }) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });

  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 30;

  doc.setFontSize(14);
  doc.text(String(title || 'Export'), marginX, 40);

  if (subtitle) {
    doc.setFontSize(10);
    doc.setTextColor(90);
    doc.text(String(subtitle), marginX, 58);
    doc.setTextColor(0);
  }

  const colCount = columns?.length || 0;
  const dense = colCount >= 10;

  autoTable(doc, {
    startY: subtitle ? 75 : 60,
    head: [columns.map((c) => c.header)],
    body: rows.map((r) => columns.map((c) => (c.value ? c.value(r) : r?.[c.key]))),
    styles: {
      fontSize: dense ? 6 : 8,
      cellPadding: dense ? 1.5 : 3,
      overflow: 'linebreak',
      cellWidth: 'auto',
      valign: 'middle',
      halign: 'center',
      lineColor: [200, 200, 200],
      lineWidth: 0.5,
    },
    headStyles: {
      fillColor: [255, 235, 59],
      textColor: 0,
      fontStyle: 'bold',
      fontSize: dense ? 7 : 8,
      halign: 'center',
      valign: 'middle',
      minCellHeight: 20,
    },
    bodyStyles: {
      minCellHeight: 18,
    },
    columnStyles: {
      0: {
        fontStyle: 'bold',
        textColor: [37, 99, 235],
        halign: 'left',
        cellWidth: 'auto',
        minCellWidth: 60,
      },
    },
    margin: { left: marginX, right: marginX, top: 60, bottom: 40 },
    tableWidth: 'auto',
    theme: 'grid',
  });

  const file = `${safeFilePart(filenameBase || 'export')}.pdf`;
  doc.save(file);
}
