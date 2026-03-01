import { clampNumber, roundTo } from '../utils/number.js';

const MAX_INC = 18;
const MAX_INC_SALES_GROWTH = 36;

export function percentToIncrement18(percent) {
  const p = clampNumber(Number(percent), 0, 100);
  return roundTo((p / 100) * MAX_INC, 2);
}

export function salesGrowthPercentToIncrement36(percent) {
  const p = clampNumber(Number(percent), 0, 200);
  return roundTo((p / 200) * MAX_INC_SALES_GROWTH, 2);
}

// Sales Return: if avg% > 10 => 0; if 0 => 18; linear reverse 0..10
export function salesReturnPercentToIncrement18(percent) {
  const pRaw = Number(percent);
  if (!Number.isFinite(pRaw)) return null;
  if (pRaw > 10) return 0;
  const p = clampNumber(pRaw, 0, 10);
  const inc = ((10 - p) / 10) * MAX_INC;
  return roundTo(inc, 2);
}

export function avg(values) {
  const nums = values.filter((v) => typeof v === 'number' && Number.isFinite(v));
  if (nums.length === 0) return null;
  const sum = nums.reduce((a, b) => a + b, 0);
  return sum / nums.length;
}

export function avgStrict(values) {
  const nums = values.map((v) => (typeof v === 'number' && Number.isFinite(v) ? v : null));
  if (nums.some((v) => v == null)) return null;
  // At this point `nums` is all numbers.
  const sum = nums.reduce((a, b) => a + b, 0);
  return sum / nums.length;
}

export function computeSeasonIncrement(season) {
  // Zero-fill rule: missing metric increments treated as 0; always divide by 4
  const values = [
    season?.salesReturn?.inc,
    season?.salesGrowth?.inc,
    season?.nrv?.inc,
    season?.paymentCollection?.inc,
  ].map((v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0));
  const sum = values.reduce((a, b) => a + b, 0);
  return sum / 4;
}

export function computeYearMetricIncFromSeasons(seasons, metricKey) {
  // Zero-fill + average rule: (Shiyadu + Unadu + Chomasu) / 3
  const values = ['shiyadu', 'unadu', 'chomasu'].map((s) => {
    const v = seasons?.[s]?.[metricKey]?.inc;
    return typeof v === 'number' && Number.isFinite(v) ? v : 0;
  });
  const sum = values.reduce((a, b) => a + b, 0);
  return sum / 3;
}

export function computeFinalIncrementPercent({ yearSalesReturnInc, yearSalesGrowthInc, yearNrvInc, yearPaymentCollectionInc, activityInc }) {
  // Zero-fill rule: missing dependencies treated as 0; always divide by 5 (behaviour removed)
  const vals = [
    yearSalesReturnInc,
    yearSalesGrowthInc,
    yearNrvInc,
    yearPaymentCollectionInc,
    activityInc,
  ].map((v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0));

  const sum = vals.reduce((a, b) => a + b, 0);
  return sum / 5;
}

export function computeSalaryNumbers(baseSalary, finalIncrementPercent) {
  const base = Number(baseSalary);
  const incP = Number(finalIncrementPercent);
  if (!Number.isFinite(base) || !Number.isFinite(incP)) {
    return { incrementAmount: null, totalSalary: null };
  }
  const incrementAmount = roundTo((base * incP) / 100, 2);
  const totalSalary = roundTo(base + incrementAmount, 2);
  return { incrementAmount, totalSalary };
}
