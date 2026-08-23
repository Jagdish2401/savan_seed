import ExcelJS from 'exceljs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function test() {
  const filePath = path.join(__dirname, 'uploads/templates/2026_shiyadu_combined_template.xlsx');
  console.log('Testing on:', filePath);
  
  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    console.log('Read successful. Sheets:', workbook.worksheets.length);

    const productName = "TEST_PROD";
    const minPrice = 999;

    for (const sheet of workbook.worksheets) {
      console.log('Processing sheet:', sheet.name);
      let nextCol = 3;
      while (sheet.getRow(2).getCell(nextCol).value) {
        nextCol += 9;
        if (nextCol > 500) break; 
      }
      console.log('Next col:', nextCol);

      sheet.getRow(1).getCell(nextCol).value = productName;
      const subHeaders = ['LAST YEAR', 'TOTAL SALE', 'NET SALE', 'TARGET', 'PRICE LIST', 'CN RATE', 'NET RATE', 'TOTAL AMT', 'SR PERCENT'];
      subHeaders.forEach((h, i) => {
        sheet.getRow(2).getCell(nextCol + i).value = h;
      });

      let minPriceRow = -1;
      for (let r = 3; r <= Math.min(sheet.rowCount + 20, 1000); r++) {
        const val = String(sheet.getRow(r).getCell(1).value || '').toLowerCase();
        if (val.includes('min') || val.includes('nrv')) {
          minPriceRow = r;
          break;
        }
      }
      console.log('Min price row:', minPriceRow);

      if (minPriceRow > 0) {
        sheet.getRow(minPriceRow).getCell(nextCol).value = `${productName} NRV`;
        sheet.getRow(minPriceRow).getCell(nextCol + 1).value = minPrice;
      }
    }

    const testOut = path.join(__dirname, 'test_output.xlsx');
    await workbook.xlsx.writeFile(testOut);
    console.log('Write successful to:', testOut);
  } catch (err) {
    console.error('CRASHED:', err);
  }
}

test();
