import express from 'express';
import multer from 'multer';
import { z } from 'zod';
import path from 'path';
import fs from 'fs/promises';
import { Employee } from '../models/Employee.js';
import { EmployeeUser } from '../models/EmployeeUser.js';
import { IncrementRecord } from '../models/IncrementRecord.js';
import Year from '../models/Year.js';
import { UploadedFile } from '../models/UploadedFile.js';
import { parseEmployeePercentAveragesFromXlsxBuffer, parseCombinedSalesNrvExcel } from '../utils/excel.js';
import {
  percentToIncrement18,
  salesReturnPercentToIncrement18,
  salesGrowthPercentToIncrement36,
  computeSeasonIncrement,
  computeYearMetricIncFromSeasons,
  computeFinalIncrementPercent,
  computeSalaryNumbers,
} from '../services/incrementMath.js';
import { roundTo } from '../utils/number.js';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = express.Router();

// Configure multer for disk storage
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadsDir = path.join(__dirname, '../../uploads/excel');
    await fs.mkdir(uploadsDir, { recursive: true });
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const year = req.params.year;
    const season = req.params.season;
    const metric = req.params.metric || 'combined'; // fallback for /upload-combined route
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    cb(null, `${year}_${season}_${metric}_${timestamp}${ext}`);
  }
});

const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

const seasonEnum = z.enum(['shiyadu', 'unadu', 'chomasu']);
const metricEnum = z.enum(['salesReturn', 'salesGrowth', 'nrv', 'paymentCollection']);
const monthSchema = z.coerce.number().int().min(1).max(12);

const MONTH_KEYS = ['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7', 'm8', 'm9', 'm10', 'm11', 'm12'];

function computeYearPctFromMonthlyZeroFill(monthlyMetric) {
  const sum = MONTH_KEYS.reduce((acc, k) => {
    const v = monthlyMetric?.[k]?.pct;
    return acc + (typeof v === 'number' && Number.isFinite(v) ? v : 0);
  }, 0);
  return sum / 12;
}

function ensureHr(req, res) {
  if (req.user?.role !== 'hr') {
    res.status(403).json({ success: false, message: 'Forbidden' });
    return false;
  }
  return true;
}

function getMissingMonthsFromMonthly(monthlyMetric) {
  const missing = [];
  for (let i = 0; i < MONTH_KEYS.length; i += 1) {
    const k = MONTH_KEYS[i];
    const v = monthlyMetric?.[k]?.pct;
    if (!(typeof v === 'number' && Number.isFinite(v))) missing.push(i + 1);
  }
  return missing;
}

function buildEmployeeLogin(name) {
  const username = name.trim().toLowerCase().replace(/\s+/g, '');
  const safe = username || 'employee';
  return {
    email: `${safe}@gmail.com`,
    password: `${safe}@123`,
  };
}

async function ensureEmployeeUserForEmployee(employee) {
  if (!employee?._id) return;
  const existing = await EmployeeUser.findOne({ employee: employee._id });
  if (existing) return;

  const { email, password } = buildEmployeeLogin(employee.name || 'employee');
  const passwordHash = await EmployeeUser.hashPassword(password);

  // If another account already took that email, skip creating to avoid conflict.
  const emailTaken = await EmployeeUser.findOne({ email });
  if (emailTaken) return;

  await EmployeeUser.create({ email, passwordHash, employee: employee._id });
}

function getDependencyCoverage(record) {
  const hasSeasonMetric = (metricKey) =>
    ['shiyadu', 'unadu', 'chomasu'].some((s) => {
      const v = record?.seasons?.[s]?.[metricKey]?.inc;
      return typeof v === 'number' && Number.isFinite(v);
    });

  const hasActivity =
    MONTH_KEYS.some((k) => {
      const v = record?.monthly?.activity?.[k]?.pct;
      return typeof v === 'number' && Number.isFinite(v);
    }) || (typeof record?.activity?.pct === 'number' && Number.isFinite(record.activity.pct));

  const detail = {
    salesReturn: hasSeasonMetric('salesReturn'),
    salesGrowth: hasSeasonMetric('salesGrowth'),
    nrv: hasSeasonMetric('nrv'),
    paymentCollection: hasSeasonMetric('paymentCollection'),
    activity: hasActivity,
  };

  const filled = Object.values(detail).filter(Boolean).length;
  return { filled, total: 5, detail };
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

router.get('/years', async (req, res) => {
  try {
    const filter = req.user?.role === 'employee' && req.user?.employee ? { employee: req.user.employee } : {};
    const recordYears = await IncrementRecord.distinct('year', filter);
    const manualYears = req.user?.role === 'hr' ? await Year.find({}, { year: 1 }) : [];
    const allYears = [...new Set([...recordYears, ...manualYears.map(y => y.year)])];
    allYears.sort((a, b) => b - a);
    return res.json({ success: true, years: allYears });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message || 'Failed to fetch years' });
  }
});

router.post('/years', async (req, res) => {
  if (!ensureHr(req, res)) return;
  try {
    const { year } = req.body;
    const yearNum = Number(year);
    
    if (!yearNum || yearNum < 2000 || yearNum > 2100) {
      return res.status(400).json({ success: false, message: 'Invalid year (must be 2000-2100)' });
    }

    // Check if year already exists in Year collection or IncrementRecord
    const existingYear = await Year.findOne({ year: yearNum });
    const hasRecords = await IncrementRecord.exists({ year: yearNum });
    
    if (existingYear || hasRecords) {
      return res.status(400).json({ success: false, message: 'Year already exists' });
    }

    await Year.create({ year: yearNum });
    return res.json({ success: true, message: `Year ${yearNum} added successfully` });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ success: false, message: 'Year already exists' });
    }
    console.error('Error adding year:', err);
    return res.status(500).json({ success: false, message: 'Failed to add year' });
  }
});

async function getOrCreateEmployeeByName(employeeName) {
  const name = employeeName.trim();
  const existing = await Employee.findOne({ name: new RegExp(`^${escapeRegExp(name)}$`, 'i') });
  if (existing) {
    await ensureEmployeeUserForEmployee(existing);
    return existing;
  }
  const created = await Employee.create({ name });
  await ensureEmployeeUserForEmployee(created);
  return created;
}

async function getOrCreateRecord(year, employeeId) {
  return IncrementRecord.findOneAndUpdate(
    { year, employee: employeeId },
    { $setOnInsert: { year, employee: employeeId } },
    { new: true, upsert: true }
  );
}

function setMetricOnSeason(record, season, metric, pctAvg) {
  const pct = roundTo(pctAvg, 2);
  const inc = metric === 'salesReturn'
    ? salesReturnPercentToIncrement18(pct)
    : metric === 'salesGrowth'
      ? salesGrowthPercentToIncrement36(pct)
      : percentToIncrement18(pct);
  record.seasons[season][metric] = { pct, inc };
  const seasonInc = computeSeasonIncrement(record.seasons[season]);
  record.seasons[season].seasonInc = seasonInc == null ? null : roundTo(seasonInc, 2);
}

function recomputeYearAndSalary(record, prevYearTotalSalary) {
  // Yearly metrics stored as AVERAGE of three seasons (missing seasons treated as 0)
  const ySrAvg = computeYearMetricIncFromSeasons(record.seasons, 'salesReturn');
  const ySgAvg = computeYearMetricIncFromSeasons(record.seasons, 'salesGrowth');
  const yNrvAvg = computeYearMetricIncFromSeasons(record.seasons, 'nrv');
  const yPcAvg = computeYearMetricIncFromSeasons(record.seasons, 'paymentCollection');

  record.yearMetrics.salesReturnInc = ySrAvg == null ? null : roundTo(ySrAvg, 2);
  record.yearMetrics.salesGrowthInc = ySgAvg == null ? null : roundTo(ySgAvg, 2);
  record.yearMetrics.nrvInc = yNrvAvg == null ? null : roundTo(yNrvAvg, 2);
  record.yearMetrics.paymentCollectionInc = yPcAvg == null ? null : roundTo(yPcAvg, 2);

  const hasAnyMonthlyActivity = MONTH_KEYS.some((k) => record.monthly?.activity?.[k]?.pct != null);

  // Monthly rule: missing months are treated as 0%.
  // Compatibility rule: if no monthly data exists but activity was set directly via legacy yearly upload,
  // keep that value (do not overwrite with 0%).
  const shouldComputeActivityFromMonthly = hasAnyMonthlyActivity || record.activity?.pct == null;

  if (shouldComputeActivityFromMonthly) {
    const activityPctYear = computeYearPctFromMonthlyZeroFill(record.monthly?.activity);
    const pct = roundTo(activityPctYear, 2);
    record.activity = { pct, inc: percentToIncrement18(pct) };
  }

  // Final increment: fixed divide-by-5 with missing dependencies treated as 0 (behaviour removed)
  const finalInc = computeFinalIncrementPercent({
    yearSalesReturnInc: ySrAvg,
    yearSalesGrowthInc: ySgAvg,
    yearNrvInc: yNrvAvg,
    yearPaymentCollectionInc: yPcAvg,
    activityInc: record.activity?.inc,
  });
  const bonus = typeof record.behaviourBonus === 'number' && Number.isFinite(record.behaviourBonus) ? record.behaviourBonus : 0;
  record.behaviourBonusApplied = bonus !== 0 ? true : record.behaviourBonusApplied;
  record.finalIncrementPercent = roundTo(finalInc + bonus, 2);

  if (typeof prevYearTotalSalary === 'number' && Number.isFinite(prevYearTotalSalary)) {
    record.baseSalary = roundTo(prevYearTotalSalary, 2);
    record.baseSalarySource = 'previousYear';
  } else {
    record.baseSalary = record.baseSalaryManual == null ? 0 : roundTo(record.baseSalaryManual, 2);
    record.baseSalarySource = 'manual';
  }

  if (record.finalIncrementPercent == null) {
    record.incrementAmount = null;
    record.totalSalary = null;
    return;
  }

  const { incrementAmount, totalSalary } = computeSalaryNumbers(record.baseSalary, record.finalIncrementPercent);
  if (incrementAmount != null) {
    record.incrementAmount = roundTo(incrementAmount, 2);
    record.totalSalary = totalSalary;
  }
}

async function getPrevYearTotalSalary(employeeId, year) {
  const prev = await IncrementRecord.findOne({ employee: employeeId, year: year - 1 }).lean();
  return prev?.totalSalary ?? null;
}

router.post('/:year/seasons/:season/metrics/:metric/upload', upload.single('file'), async (req, res) => {
  if (!ensureHr(req, res)) return;
  try {
    const year = Number(req.params.year);
    if (!Number.isInteger(year) || year < 2000 || year > 3000) {
      return res.status(400).json({ success: false, message: 'Invalid year' });
    }
    const season = seasonEnum.parse(req.params.season);
    const metric = metricEnum.parse(req.params.metric);

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Excel file required (field name: file)' });
    }

    // Read the file buffer for parsing
    const fileBuffer = await fs.readFile(req.file.path);
    
    const parsed = await parseEmployeePercentAveragesFromXlsxBuffer(fileBuffer);
    if (parsed.detectedYear != null && parsed.detectedYear !== year) {
      return res.status(400).json({
        success: false,
        message: `Year mismatch: selected year ${year}, but Excel indicates ${parsed.detectedYear} (${parsed.detectedYearSource || 'date/year column'}). Please select ${parsed.detectedYear} and upload again.`,
        selectedYear: year,
        excelYear: parsed.detectedYear,
        detectedYear: parsed.detectedYear,
        detectedYearSource: parsed.detectedYearSource || null,
      });
    }

    let updated = 0;
    const unknown = [];

    for (const { employeeName, avgPercent, percentValues, computedPercentValues, effectivePercentValues } of parsed.employees.values()) {
      const employee = await getOrCreateEmployeeByName(employeeName);
      if (!employee) {
        unknown.push(employeeName);
        continue;
      }

      const record = await getOrCreateRecord(year, employee._id);
      
      // For salesReturn: compute % per row (prefer Dispatch/Return-derived %), convert each % to increment, then average.
      if (metric === 'salesReturn') {
        const pctRows = Array.isArray(effectivePercentValues) && effectivePercentValues.length > 0
          ? effectivePercentValues
          : (Array.isArray(computedPercentValues) && computedPercentValues.length > 0
            ? computedPercentValues
            : (Array.isArray(percentValues) ? percentValues : []));
        if (pctRows.length === 0) {
          // Nothing usable in the sheet for this employee
          continue;
        }

        const increments = pctRows
          .map((pct) => salesReturnPercentToIncrement18(pct))
          .filter((v) => typeof v === 'number' && Number.isFinite(v));

        if (increments.length === 0) continue;

        const avgIncrement = roundTo(increments.reduce((a, b) => a + b, 0) / increments.length, 2);
        
        // Store the average percentage and average increment directly
        const avgPct = roundTo(pctRows.reduce((a, b) => a + b, 0) / pctRows.length, 2);
        record.seasons[season][metric] = { pct: avgPct, inc: avgIncrement };
        const seasonInc = computeSeasonIncrement(record.seasons[season]);
        record.seasons[season].seasonInc = seasonInc == null ? null : roundTo(seasonInc, 2);

      } else {
        // For salesGrowth, nrv, paymentCollection: ONLY use Percentage cell values (not computed/fallback)
        // If no percentValues, skip this employee
        if (!percentValues || percentValues.length === 0) continue;
        const avgPct = roundTo(percentValues.reduce((a, b) => a + b, 0) / percentValues.length, 2);
        setMetricOnSeason(record, season, metric, avgPct);
      }

      const prevTotal = await getPrevYearTotalSalary(employee._id, year);
      recomputeYearAndSalary(record, prevTotal);

      await record.save();
      updated += 1;
    }

    // Store file metadata in database
    await UploadedFile.findOneAndUpdate(
      { year, season, metric },
      {
        year,
        season,
        metric,
        filename: req.file.filename,
        originalName: req.file.originalname,
        path: req.file.path,
        mimetype: req.file.mimetype,
        size: req.file.size,
      },
      { upsert: true, new: true }
    );

    return res.json({
      success: true,
      updated,
      detectedColumns: { nameCol: parsed.nameCol, percentCol: parsed.percentCol },
      detectedYear: parsed.detectedYear ?? null,
      detectedYearSource: parsed.detectedYearSource ?? null,
      message: parsed.detectedYear != null ? `Detected year ${parsed.detectedYear} from ${parsed.detectedYearSource || 'date/year column'}.` : null,
      unknownEmployees: unknown,
    });
  } catch (e) {
    // Clean up uploaded file on error
    if (req.file?.path) {
      await fs.unlink(req.file.path).catch(() => {});
    }
    return res.status(400).json({ success: false, message: e.message || 'Upload failed' });
  }
});



// ── Combined upload: Sales Growth + Sales Return + NRV in one file ───────────
// POST /:year/seasons/:season/upload-combined
// Body (multipart/form-data): file (Excel with one sheet per employee, sheet name = employee name)
//
// Excel structure per sheet:
//   Sheet name: Employee name (e.g. "Jagdish")
//   Row 1: Product names (each spanning 9 columns, starting at column C)
//   Row 2: LAST YEAR | TOTAL SALE | SALE RETURN | NET SALE |
//          PRICE (AS PER LIST) | CN RATE | NET RATE | TOTAL AMT | S R PERCENTAGE
//   Row 3+: Party rows — Col A: PARTY NAME, Col B: place
//   After last party row: Min_Price label + value per product block
//
router.post('/:year/seasons/:season/upload-combined', upload.single('file'), async (req, res) => {
  if (!ensureHr(req, res)) return;
  try {
    const year = Number(req.params.year);
    if (!Number.isInteger(year) || year < 2000 || year > 3000) {
      return res.status(400).json({ success: false, message: 'Invalid year' });
    }
    const season = seasonEnum.parse(req.params.season);

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Excel file required (field name: file)' });
    }

    const fileBuffer = await fs.readFile(req.file.path);
    const { employees: parsedEmployees, errors: parseErrors } = await parseCombinedSalesNrvExcel(fileBuffer);

    const savedResults = [];

    for (const parsed of parsedEmployees) {
      const employee = await getOrCreateEmployeeByName(parsed.employeeName);
      const record   = await getOrCreateRecord(year, employee._id);

      // ── Set salesReturn ─────────────────────────────────────────────────
      record.seasons[season].salesReturn = {
        pct: roundTo(parsed.avgSRPct, 2),
        inc: roundTo(parsed.avgSrInc, 2),
      };

      // ── Set salesGrowth ─────────────────────────────────────────────────
      record.seasons[season].salesGrowth = {
        pct: roundTo(parsed.avgSalesGrowthPct, 2),
        inc: roundTo(parsed.avgSalesGrowthInc, 2),
      };

      // ── Set nrv ─────────────────────────────────────────────────────────
      record.seasons[season].nrv = {
        pct: roundTo(parsed.avgNrvInc, 2),
        inc: roundTo(parsed.avgNrvInc, 2),
      };

      // Recompute season increment and yearly/salary
      const seasonInc = computeSeasonIncrement(record.seasons[season]);
      record.seasons[season].seasonInc = seasonInc == null ? null : roundTo(seasonInc, 2);

      const prevTotal = await getPrevYearTotalSalary(employee._id, year);
      recomputeYearAndSalary(record, prevTotal);
      await record.save();

      savedResults.push({
        employee:           employee.name,
        avgNrvInc:          parsed.avgNrvInc,
        avgSalesGrowthInc:  parsed.avgSalesGrowthInc,
        avgSalesGrowthPct:  parsed.avgSalesGrowthPct,
        avgSrInc:           parsed.avgSrInc,
        avgSRPct:           parsed.avgSRPct,
        productsProcessed:  parsed.products.length,
        noMinPriceProducts: parsed.noMinPriceProducts ?? [],
        seasonInc:          record.seasons[season].seasonInc,
        yearSalesReturnInc:    record.yearMetrics?.salesReturnInc ?? null,
        yearSalesGrowthInc:    record.yearMetrics?.salesGrowthInc ?? null,
        yearNrvInc:            record.yearMetrics?.nrvInc ?? null,
        finalIncrementPercent: record.finalIncrementPercent ?? null,
      });
    }

    // Store file metadata (one record per season, metric = 'combined')
    await UploadedFile.findOneAndUpdate(
      { year, season, metric: 'combined' },
      {
        year,
        season,
        metric: 'combined',
        filename:     req.file.filename,
        originalName: req.file.originalname,
        path:         req.file.path,
        mimetype:     req.file.mimetype,
        size:         req.file.size,
      },
      { upsert: true, new: true }
    );

    return res.json({
      success:        true,
      season,
      year,
      employeesProcessed: savedResults.length,
      employees:      savedResults,
      sheetErrors:    parseErrors,   // sheets that were skipped due to errors
    });
  } catch (e) {
    if (req.file?.path) await fs.unlink(req.file.path).catch(() => {});
    return res.status(400).json({ success: false, message: e.message || 'Combined upload failed' });
  }
});

// GET uploaded files for a year
router.get('/:year/uploaded-files', async (req, res) => {
  if (!ensureHr(req, res)) return;
  try {
    const year = Number(req.params.year);
    if (!Number.isInteger(year) || year < 2000 || year > 3000) {
      return res.status(400).json({ success: false, message: 'Invalid year' });
    }

    const files = await UploadedFile.find({ year }).sort({ createdAt: -1 });
    return res.json({ success: true, files });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message || 'Failed to fetch files' });
  }
});

// Download uploaded file (individual metric)
router.get('/:year/seasons/:season/metrics/:metric/download', async (req, res) => {
  if (!ensureHr(req, res)) return;
  try {
    const year = Number(req.params.year);
    if (!Number.isInteger(year) || year < 2000 || year > 3000) {
      return res.status(400).json({ success: false, message: 'Invalid year' });
    }
    const season = seasonEnum.parse(req.params.season);
    const metric = metricEnum.parse(req.params.metric);

    const file = await UploadedFile.findOne({ year, season, metric });
    if (!file) {
      return res.status(404).json({ success: false, message: 'No file found for this metric' });
    }

    try {
      await fs.access(file.path);
    } catch {
      return res.status(404).json({ success: false, message: 'File not found on server' });
    }

    res.download(file.path, file.originalName);
  } catch (e) {
    return res.status(400).json({ success: false, message: e.message || 'Download failed' });
  }
});

// Download combined uploaded file
router.get('/:year/seasons/:season/download-combined', async (req, res) => {
  if (!ensureHr(req, res)) return;
  try {
    const year = Number(req.params.year);
    if (!Number.isInteger(year) || year < 2000 || year > 3000) {
      return res.status(400).json({ success: false, message: 'Invalid year' });
    }
    const season = seasonEnum.parse(req.params.season);

    const file = await UploadedFile.findOne({ year, season, metric: 'combined' });
    if (!file) {
      return res.status(404).json({ success: false, message: 'No combined file found for this season' });
    }

    try {
      await fs.access(file.path);
    } catch {
      return res.status(404).json({ success: false, message: 'File not found on server' });
    }

    res.download(file.path, file.originalName);
  } catch (e) {
    return res.status(400).json({ success: false, message: e.message || 'Download failed' });
  }
});

router.post('/:year/activity/upload', upload.single('file'), async (req, res) => {
  if (!ensureHr(req, res)) return;
  try {
    const year = Number(req.params.year);
    if (!Number.isInteger(year)) return res.status(400).json({ success: false, message: 'Invalid year' });
    if (!req.file) return res.status(400).json({ success: false, message: 'Excel file required (field name: file)' });

    const fileBuffer = await fs.readFile(req.file.path);
    const parsed = await parseEmployeePercentAveragesFromXlsxBuffer(fileBuffer);
    if (parsed.detectedYear != null && parsed.detectedYear !== year) {
      return res.status(400).json({
        success: false,
        message: `Year mismatch: selected year ${year}, but Excel indicates ${parsed.detectedYear} (${parsed.detectedYearSource || 'date/year column'}). Please select ${parsed.detectedYear} and upload again.`,
        selectedYear: year,
        excelYear: parsed.detectedYear,
        detectedYear: parsed.detectedYear,
        detectedYearSource: parsed.detectedYearSource || null,
      });
    }
    let updated = 0;

    for (const { employeeName, avgPercent } of parsed.employees.values()) {
      const employee = await getOrCreateEmployeeByName(employeeName);
      const record = await getOrCreateRecord(year, employee._id);
      const pct = roundTo(avgPercent, 2);
      record.activity = { pct, inc: percentToIncrement18(pct) };

      const prevTotal = await getPrevYearTotalSalary(employee._id, year);
      recomputeYearAndSalary(record, prevTotal);
      await record.save();
      updated += 1;
    }

    return res.json({
      success: true,
      updated,
      detectedColumns: { nameCol: parsed.nameCol, percentCol: parsed.percentCol },
      detectedYear: parsed.detectedYear ?? null,
      detectedYearSource: parsed.detectedYearSource ?? null,
      message: parsed.detectedYear != null ? `Detected year ${parsed.detectedYear} from ${parsed.detectedYearSource || 'date/year column'}.` : null,
    });
  } catch (e) {
    return res.status(400).json({ success: false, message: e.message || 'Upload failed' });
  }
});

router.post('/:year/activity/:month/upload', upload.single('file'), async (req, res) => {
  if (!ensureHr(req, res)) return;
  try {
    const year = Number(req.params.year);
    if (!Number.isInteger(year)) return res.status(400).json({ success: false, message: 'Invalid year' });
    const month = monthSchema.parse(req.params.month);
    if (!req.file) return res.status(400).json({ success: false, message: 'Excel file required (field name: file)' });

    const fileBuffer = await fs.readFile(req.file.path);
    const parsed = await parseEmployeePercentAveragesFromXlsxBuffer(fileBuffer);
    if (parsed.detectedYear != null && parsed.detectedYear !== year) {
      return res.status(400).json({
        success: false,
        message: `Year mismatch: selected year ${year}, but Excel indicates ${parsed.detectedYear} (${parsed.detectedYearSource || 'date/year column'}). Please select ${parsed.detectedYear} and upload again.`,
        selectedYear: year,
        excelYear: parsed.detectedYear,
        detectedYear: parsed.detectedYear,
        detectedYearSource: parsed.detectedYearSource || null,
      });
    }
    let updated = 0;

    for (const { employeeName, avgPercent } of parsed.employees.values()) {
      const employee = await getOrCreateEmployeeByName(employeeName);
      const record = await getOrCreateRecord(year, employee._id);

      const pct = roundTo(avgPercent, 2);
      record.monthly.activity[`m${month}`] = { pct, inc: percentToIncrement18(pct) };

      const prevTotal = await getPrevYearTotalSalary(employee._id, year);
      recomputeYearAndSalary(record, prevTotal);
      await record.save();
      updated += 1;
    }

    return res.json({
      success: true,
      updated,
      month,
      detectedColumns: { nameCol: parsed.nameCol, percentCol: parsed.percentCol },
      detectedYear: parsed.detectedYear ?? null,
      detectedYearSource: parsed.detectedYearSource ?? null,
      message: parsed.detectedYear != null ? `Detected year ${parsed.detectedYear} from ${parsed.detectedYearSource || 'date/year column'}.` : null,
    });
  } catch (e) {
    return res.status(400).json({ success: false, message: e.message || 'Upload failed' });
  }
});

router.post('/:year/behaviour/upload', upload.single('file'), async (req, res) => {
  if (!ensureHr(req, res)) return;
  try {
    if (req.file?.path) await fs.unlink(req.file.path).catch(() => {});
    return res.status(410).json({ success: false, message: 'Behaviour metric has been removed and uploads are disabled.' });
  } catch (e) {
    return res.status(400).json({ success: false, message: e.message || 'Upload failed' });
  }
});

router.post('/:year/behaviour/:month/upload', upload.single('file'), async (req, res) => {
  if (!ensureHr(req, res)) return;
  try {
    if (req.file?.path) await fs.unlink(req.file.path).catch(() => {});
    return res.status(410).json({ success: false, message: 'Behaviour metric has been removed and uploads are disabled.' });
  } catch (e) {
    return res.status(400).json({ success: false, message: e.message || 'Upload failed' });
  }
});

router.get('/:year/seasons/:season', async (req, res) => {
  try {
    const year = Number(req.params.year);
    if (!Number.isInteger(year) || year < 2000 || year > 3000) {
      return res.status(400).json({ success: false, message: 'Invalid year' });
    }
    const season = seasonEnum.parse(req.params.season);
    const filter = { year };
    if (req.user?.role === 'employee') {
      if (!req.user.employee) return res.status(403).json({ success: false, message: 'Forbidden' });
      filter.employee = req.user.employee;
    }

    const records = await IncrementRecord.find(filter)
      .populate('employee')
      .lean();

    const rows = records.map((r) => ({
      employeeName: r.employee?.name,
      salesReturnInc: r.seasons?.[season]?.salesReturn?.inc ?? null,
      salesGrowthInc: r.seasons?.[season]?.salesGrowth?.inc ?? null,
      nrvInc: r.seasons?.[season]?.nrv?.inc ?? null,
      paymentCollectionInc: r.seasons?.[season]?.paymentCollection?.inc ?? null,
      seasonInc: r.seasons?.[season]?.seasonInc ?? null,
    }));

    return res.json({ success: true, year, season, rows });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message || 'Failed to fetch season data' });
  }
});

router.get('/:year/monthly/:month', async (req, res) => {
  try {
    const year = Number(req.params.year);
    if (!Number.isInteger(year) || year < 2000 || year > 3000) {
      return res.status(400).json({ success: false, message: 'Invalid year' });
    }
    const month = monthSchema.parse(req.params.month);
    const monthKey = `m${month}`;
    const filter = { year };
    if (req.user?.role === 'employee') {
      if (!req.user.employee) return res.status(403).json({ success: false, message: 'Forbidden' });
      filter.employee = req.user.employee;
    }

    const records = await IncrementRecord.find(filter)
      .populate('employee')
      .lean();

    const rows = records.map((r) => {
      const activityPct = r?.monthly?.activity?.[monthKey]?.pct;
      const a = typeof activityPct === 'number' && Number.isFinite(activityPct) ? activityPct : 0;
      return {
        employeeName: r.employee?.name,
        activityPct: roundTo(a, 2),
      };
    });

    return res.json({ success: true, year, month, rows });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message || 'Failed to fetch monthly data' });
  }
});

router.get('/:year/yearly', async (req, res) => {
  try {
  const year = Number(req.params.year);
  if (!Number.isInteger(year) || year < 2000 || year > 3000) {
    return res.status(400).json({ success: false, message: 'Invalid year' });
  }

  const filter = { year };
  if (req.user?.role === 'employee') {
    if (!req.user.employee) return res.status(403).json({ success: false, message: 'Forbidden' });
    filter.employee = req.user.employee;
  }

  const records = await IncrementRecord.find(filter)
    .populate('employee')
    .lean();

  const rows = records.map((r) => {
    const coverage = getDependencyCoverage(r);

    return {
      employeeName: r.employee?.name,
      yearSalesReturnInc: r.yearMetrics?.salesReturnInc ?? null,
      yearSalesGrowthInc: r.yearMetrics?.salesGrowthInc ?? null,
      yearNrvInc: r.yearMetrics?.nrvInc ?? null,
      yearPaymentCollectionInc: r.yearMetrics?.paymentCollectionInc ?? null,
      activityInc: r.activity?.inc ?? null,
      activityMissingMonths: getMissingMonthsFromMonthly(r.monthly?.activity),
      finalIncrementPercent: r.finalIncrementPercent ?? null,
      behaviourBonusApplied: r.behaviourBonusApplied ?? false,
      behaviourBonus: r.behaviourBonus ?? 0,
      baseSalary: r.baseSalary ?? 0,
      baseSalarySource: r.baseSalarySource ?? 'manual',
      incrementAmount: r.incrementAmount ?? null,
      totalSalary: r.totalSalary ?? null,
      dependenciesFilled: coverage.filled,
      dependenciesTotal: coverage.total,
      dependenciesDetail: coverage.detail,
    };
  });

  return res.json({ success: true, year, rows });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message || 'Failed to fetch yearly data' });
  }
});

const baseSalarySchema = z.object({
  employeeName: z.string().min(1),
  baseSalary: z.number().nonnegative(),
});

router.post('/:year/base-salaries', async (req, res) => {
  if (!ensureHr(req, res)) return;
  try {
    const year = Number(req.params.year);
    if (!Number.isInteger(year)) return res.status(400).json({ success: false, message: 'Invalid year' });

    const body = z.array(baseSalarySchema).parse(req.body);

    let updated = 0;
    const skipped = [];

    for (const item of body) {
      const employee = await getOrCreateEmployeeByName(item.employeeName);
      const record = await getOrCreateRecord(year, employee._id);
      const prevTotal = await getPrevYearTotalSalary(employee._id, year);
      const lockedByPrevYear = typeof prevTotal === 'number' && Number.isFinite(prevTotal);
      const lockedBySource = record.baseSalarySource === 'previousYear';

      if (lockedByPrevYear || lockedBySource) {
        recomputeYearAndSalary(record, prevTotal);
        await record.save();
        skipped.push(item.employeeName);
        continue;
      }

      record.baseSalaryManual = roundTo(item.baseSalary, 2);
      recomputeYearAndSalary(record, prevTotal);

      await record.save();
      updated += 1;
    }

    return res.json({ success: true, updated, skipped });
  } catch (e) {
    return res.status(400).json({ success: false, message: e.message || 'Invalid request' });
  }
});

const behaviourOverrideSchema = z.object({
  employeeName: z.string().min(1),
  apply: z.boolean(),
});

router.post('/:year/behaviour-bonus', async (req, res) => {
  if (!ensureHr(req, res)) return;
  try {
    const year = Number(req.params.year);
    if (!Number.isInteger(year)) return res.status(400).json({ success: false, message: 'Invalid year' });

    const body = z.array(behaviourOverrideSchema).parse(req.body);
    let updated = 0;
    const skipped = [];

    for (const item of body) {
      const employee = await getOrCreateEmployeeByName(item.employeeName);
      const record = await getOrCreateRecord(year, employee._id);
      const prevTotal = await getPrevYearTotalSalary(employee._id, year);

      // One-time apply: once bonus is applied, ignore attempts to remove
      if (record.behaviourBonusApplied && record.behaviourBonus > 0 && item.apply === false) {
        skipped.push(item.employeeName);
        continue;
      }

      record.behaviourBonus = item.apply ? 1 : 0;
      record.behaviourBonusApplied = item.apply ? true : record.behaviourBonusApplied;

      recomputeYearAndSalary(record, prevTotal);
      await record.save();
      updated += 1;
    }

    return res.json({ success: true, updated, skipped });
  } catch (e) {
    return res.status(400).json({ success: false, message: e.message || 'Invalid request' });
  }
});

export default router;
