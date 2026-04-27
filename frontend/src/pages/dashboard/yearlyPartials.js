import { inc18ToCompositeScore, toNumOrZero } from './format.js';

export function augmentYearlyRowsWithPartialFromSeasons(strictYearlyRows, seasonsByKey) {
  const seasonsByEmployee = new Map();
  for (const seasonKey of ['shiyadu', 'unadu', 'chomasu']) {
    for (const r of seasonsByKey?.[seasonKey] || []) {
      const name = r?.employeeName;
      if (!name) continue;
      const prev = seasonsByEmployee.get(name) || {};
      prev[seasonKey] = r;
      seasonsByEmployee.set(name, prev);
    }
  }

  return (strictYearlyRows || []).map((r) => {
    const seasons = seasonsByEmployee.get(r.employeeName) || {};
    const getSeasonInc = (seasonKey, field) => toNumOrZero(seasons?.[seasonKey]?.[field]);
    const anySeasonHas = (field) =>
      ['shiyadu', 'unadu', 'chomasu'].some((s) => {
        const v = seasons?.[s]?.[field];
        return typeof v === 'number' && Number.isFinite(v);
      });

    // Partial yearly metric increments (out of 18): missing seasons/metrics treated as 0.
    const partialYearSalesReturnInc =
      (getSeasonInc('shiyadu', 'salesReturnInc') + getSeasonInc('unadu', 'salesReturnInc') + getSeasonInc('chomasu', 'salesReturnInc')) / 3;
    const partialYearSalesGrowthInc =
      (getSeasonInc('shiyadu', 'salesGrowthInc') + getSeasonInc('unadu', 'salesGrowthInc') + getSeasonInc('chomasu', 'salesGrowthInc')) / 3;
    const partialYearNrvInc = (getSeasonInc('shiyadu', 'nrvInc') + getSeasonInc('unadu', 'nrvInc') + getSeasonInc('chomasu', 'nrvInc')) / 3;
    const partialYearPaymentCollectionInc =
      (getSeasonInc('shiyadu', 'paymentCollectionInc') +
        getSeasonInc('unadu', 'paymentCollectionInc') +
        getSeasonInc('chomasu', 'paymentCollectionInc')) /
      3;

    const activityInc = toNumOrZero(r.activityInc);

    // Partial final increment: missing dependencies treated as 0.
    const partialFinalIncrementPercent =
      (partialYearSalesReturnInc + partialYearSalesGrowthInc + partialYearNrvInc + partialYearPaymentCollectionInc + activityInc) / 5;

    const depsFilled = typeof r.dependenciesFilled === 'number' && Number.isFinite(r.dependenciesFilled) ? r.dependenciesFilled : null;
    const depsTotal = typeof r.dependenciesTotal === 'number' && Number.isFinite(r.dependenciesTotal) ? r.dependenciesTotal : 5;

    const partialFilledFallback =
      (anySeasonHas('salesReturnInc') ? 1 : 0) +
      (anySeasonHas('salesGrowthInc') ? 1 : 0) +
      (anySeasonHas('nrvInc') ? 1 : 0) +
      (anySeasonHas('paymentCollectionInc') ? 1 : 0) +
      (r.activityInc == null ? 0 : 1);

    const partialFilled = depsFilled ?? partialFilledFallback;

    const compositeScore = inc18ToCompositeScore(r.finalIncrementPercent != null ? r.finalIncrementPercent : partialFinalIncrementPercent);
    const compositeScoreIsFinal = depsFilled != null ? depsFilled >= depsTotal : r.finalIncrementPercent != null;

    // Extract season increments for season breakdown card
    const shiyaduSeasonInc = seasons?.shiyadu?.seasonInc ?? null;
    const unaduSeasonInc = seasons?.unadu?.seasonInc ?? null;
    const chomasuSeasonInc = seasons?.chomasu?.seasonInc ?? null;

    return {
      ...r,
      partialFinalIncrementPercent,
      partialFilled,
      compositeScore,
      compositeScoreIsFinal,
      shiyaduSeasonInc,
      unaduSeasonInc,
      chomasuSeasonInc,
    };
  });
}
