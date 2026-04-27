
import ExcelJS from 'exceljs';
import { validateTemplateStructure } from './src/routes/templates.js';
import { parseEmployeePercentAveragesFromXlsxBuffer } from './src/utils/excel.js';
import fs from 'fs/promises';
import path from 'path';

async function dryRun() {
  console.log('🚀 Starting Dry Run for Payment Collection Template...');
  
  const employees = [
    { empId: 'SS01', firstName: 'Rajesh' },
    { empId: 'SS02', firstName: 'Amit' }
  ];

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Payment Collection');

  // 1. Generate Headers (Mirroring backend logic)
  sheet.getCell(2, 1).value = 'Date';
  sheet.getCell(2, 2).value = 'Day';
  sheet.getCell(2, 3).value = 'General Notes';
  
  let currentCol = 4;
  employees.forEach((emp) => {
    sheet.getCell(1, currentCol).value = `${emp.empId} - ${emp.firstName}`;
    sheet.mergeCells(1, currentCol, 1, currentCol + 3);
    
    ['Invoice Amount', 'Collected Amount', 'Outstanding', 'Collection %'].forEach((h, i) => {
      sheet.getCell(2, currentCol + i).value = h;
    });
    
    // 2. Add Dummy Data & Formulas
    for (let r = 3; r <= 5; r++) {
       const c1 = sheet.getCell(r, currentCol).address;
       const c2 = sheet.getCell(r, currentCol + 1).address;
       const c3 = sheet.getCell(r, currentCol + 2);
       const c4 = sheet.getCell(r, currentCol + 3);
       
       // Populate col 1 & 2
       sheet.getCell(r, currentCol).value = 1000 * r;
       sheet.getCell(r, currentCol + 1).value = 500 * r;
       
       // Add Formulas (Backend generation logic)
       c3.value = { formula: `${c1}-${c2}`, result: 500 * r };
       c4.value = { formula: `IF(${c1}=0,0,(${c2}/${c1})*100)`, result: 50 };
    }
    currentCol += 4;
  });

  const testFilePath = path.resolve('payment_dry_run_test.xlsx');
  await workbook.xlsx.writeFile(testFilePath);
  console.log('✅ Generated Test File:', testFilePath);

  // 3. Verify with Validation Function
  console.log('🔍 Running Validation Check...');
  const validation = await validateTemplateStructure(testFilePath, 'paymentCollection');
  console.log('Validation Result:', validation);

  // 4. Verify with Parser Function
  console.log('🔍 Running Parser Check...');
  const buffer = await fs.readFile(testFilePath);
  const parsed = await parseEmployeePercentAveragesFromXlsxBuffer(buffer);
  
  console.log('Parsed Employees:', Array.from(parsed.employees.keys()));
  parsed.employees.forEach((data, name) => {
    console.log(`Employee: ${data.employeeName}`);
    console.log(`  Average %: ${data.avgPercent}%`);
    console.log(`  Raw % Values:`, data.values);
  });

  // Cleanup
  await fs.unlink(testFilePath);
  console.log('🧹 Cleanup complete.');
}

dryRun().catch(console.error);
