import { clamp01to100, fmt, fmtCurrency, fmtScore } from '../format.js';

export default function YearlyTab({
  busy,
  yearlyRows,
  yearlyRowsView,
  getPaginatedData,
  renderPagination,
  handleDownloadExcel,
  handleDownloadPdf,
  saveBaseSalaries,
  behaviourOverrides,
  behaviourConfirmed,
  handleBehaviourNo,
  handleBehaviourYes,
  canEditBaseSalary,
  baseSalaryEdits,
  setBaseSalaryEdits,
}) {
  return (
    <div>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              background: 'var(--primary-soft)',
              color: 'var(--primary)',
              width: '40px',
              height: '40px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.5rem',
              border: '1px solid rgba(22, 163, 74, 0.25)'
            }}>
              📊
            </div>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '600', margin: 0 }}>
                Yearly Summary & Salary Calculation
              </h2>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-light)', margin: 0 }}>
                {yearlyRowsView.length} employee{yearlyRowsView.length !== 1 ? 's' : ''} • Final increment & salary details
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button onClick={handleDownloadExcel} disabled={busy || yearlyRows.length === 0} className="btn btn-secondary">
              Download Excel
            </button>
            <button onClick={handleDownloadPdf} disabled={busy || yearlyRows.length === 0} className="btn btn-secondary">
              Download PDF
            </button>
            <button onClick={saveBaseSalaries} disabled={busy} className="btn btn-success" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>💾</span>
              <span>Save Base Salaries</span>
            </button>
          </div>
        </div>

        {/* Behaviour toggles: no missing-month warning to avoid confusion after uploads */}

        <div className="table-scroll-wrapper">
          <table>
            <thead>
              <tr>
                <th className="sticky-col">Employee</th>
                <th className="table-number">Sales Return Inc</th>
                <th className="table-number">Sales Growth Inc</th>
                <th className="table-number">NRV Inc</th>
                <th className="table-number">Payment Inc</th>
                <th className="table-number">Activity Inc</th>
                <th className="table-number">Behaviour</th>
                <th className="table-number">Final Inc %</th>
                <th className="table-number">Composite Score</th>
                <th className="table-number">Base Salary</th>
                <th className="table-number">Increment</th>
                <th className="table-number">Total Salary</th>
              </tr>
            </thead>
            <tbody>
              {getPaginatedData(yearlyRowsView).map((r) => (
                <tr key={r.employeeName}>
                  <td className="sticky-col" style={{ fontWeight: '500' }}>{r.employeeName}</td>
                  <td className="table-number">{fmt(r.yearSalesReturnInc)}</td>
                  <td className="table-number">{fmt(r.yearSalesGrowthInc)}</td>
                  <td className="table-number">{fmt(r.yearNrvInc)}</td>
                  <td className="table-number">{fmt(r.yearPaymentCollectionInc)}</td>
                  <td className="table-number">{fmt(r.activityInc)}</td>
                  <td className="table-number">
                    <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'flex-end' }}>
                      <button
                        className={!behaviourOverrides[r.employeeName] ? 'btn btn-primary btn-xs' : 'btn btn-secondary btn-xs'}
                        onClick={() => handleBehaviourNo(r.employeeName)}
                        style={{ minWidth: '50px' }}
                        disabled={behaviourConfirmed[r.employeeName]}
                      >
                        No
                      </button>
                      <button
                        className={behaviourOverrides[r.employeeName] ? 'btn btn-primary btn-xs' : 'btn btn-secondary btn-xs'}
                        onClick={() => handleBehaviourYes(r.employeeName)}
                        style={{ minWidth: '50px' }}
                        disabled={behaviourConfirmed[r.employeeName]}
                      >
                        Yes
                      </button>
                    </div>
                  </td>
                  <td className="table-number" style={{ fontWeight: '600', color: 'var(--success)' }}>
                    {fmt(r.adjustedFinalIncrement)}
                  </td>
                  <td className="table-number">
                    {(() => {
                      const score = typeof r.adjustedCompositeScore === 'number' && Number.isFinite(r.adjustedCompositeScore) ? r.adjustedCompositeScore : 0;
                      const clamped = clamp01to100(score);
                      const isPartial = !r.compositeScoreIsFinal;
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', minWidth: '90px' }}>
                          <div style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtScore(clamped)}</div>
                          <div
                            style={{
                              width: '72px',
                              height: '6px',
                              borderRadius: '999px',
                              background: 'var(--border)',
                              overflow: 'hidden',
                            }}
                          >
                            <div
                              style={{
                                height: '100%',
                                width: `${clamped}%`,
                                background: isPartial ? 'var(--primary)' : 'var(--success)',
                              }}
                            />
                          </div>
                        </div>
                      );
                    })()}
                  </td>
                  <td className="table-number">
                    {canEditBaseSalary[r.employeeName] ? (
                      <input
                        type="number"
                        className="input input-sm"
                        value={baseSalaryEdits[r.employeeName] ?? 0}
                        min={0}
                        onChange={(e) =>
                          setBaseSalaryEdits((prev) => ({
                            ...prev,
                            [r.employeeName]: Number(e.target.value),
                          }))
                        }
                        style={{ width: '120px', textAlign: 'right' }}
                      />
                    ) : (
                      <span>{fmtCurrency(r.baseSalary)}</span>
                    )}
                  </td>
                  <td className="table-number" style={{ color: 'var(--success)' }}>
                    {fmtCurrency(r.adjustedIncrementAmount)}
                  </td>
                  <td className="table-number" style={{ fontWeight: '600', color: 'var(--primary)' }}>
                    {fmtCurrency(r.adjustedTotalSalary)}
                  </td>
                </tr>
              ))}
              {yearlyRowsView.length === 0 && (
                <tr>
                  <td colSpan={12} className="empty-state">
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📊</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: '500', color: 'var(--text)', marginBottom: '0.5rem' }}>
                      No Yearly Data Available
                    </div>
                    <div style={{ fontSize: '0.95rem' }}>
                      Complete season uploads and yearly activity data to see final calculations
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {renderPagination(yearlyRowsView)}
      </div>
    </div>
  );
}
