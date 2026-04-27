import fs from 'fs';
import path from 'path';

const filePath = './src/routes/templates.js';
let content = fs.readFileSync(filePath, 'utf8');

const oldLoop = `      // Add borders
      for (let i = 0; i < 4; i++) {
        sheet.getCell(r, currentCol + i).border = {
          top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
        };
      }`;

const newLoop = `      // Add borders and dropdowns
      for (let i = 0; i < 4; i++) {
        const cell = sheet.getCell(r, currentCol + i);
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
        };

        if (type === 'activity') {
          if (i === 0) { // Meeting Attended
            cell.dataValidation = { type: 'list', allowBlank: true, formulae: ['"Yes,No"'] };
          } else if (i === 1) { // Field Work
            cell.dataValidation = { type: 'list', allowBlank: true, formulae: ['"Completed,In Progress,Not Started"'] };
          }
        }
      }`;

// Use a more robust replacement that ignores CRLF differences
const lines = content.split(/\r?\n/);
let startIndex = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('// Add borders') && lines[i+1] && lines[i+1].includes('for (let i = 0; i < 4; i++)')) {
    startIndex = i;
    break;
  }
}

if (startIndex !== -1) {
  lines.splice(startIndex, 9, ...newLoop.split('\n'));
  fs.writeFileSync(filePath, lines.join('\n'));
  console.log('Successfully patched templates.js');
} else {
  console.log('Could not find the target loop in templates.js');
}
