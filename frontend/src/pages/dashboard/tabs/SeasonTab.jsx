import { BarChart2, Download, TrendingUp } from 'lucide-react';

import { METRICS, SEASONS } from '../constants.js';
import SeasonCombinedItemAnalytics from './SeasonCombinedItemAnalytics.jsx';

export default function SeasonTab({
  tab,
  seasonSubTab,
  setSeasonSubTab,
  seasonRows,
  busy,
  handleDownloadExcel,
  handleDownloadPdf,
  getPaginatedData,
  fmt,
  renderPagination,
  downloadSeasonFile,
  uploadedFiles,
  combinedItemsBySeason,
  uploadCombined,
  downloadTemplate,
  uploadSeasonMetric,
}) {
  const combinedPayload = combinedItemsBySeason?.[tab];

  return (
    <div className="fade-in">
      {/* Season Sub-Navigation */}
      <div className="card" style={{ padding: '0.5rem', marginBottom: '1.5rem', display: 'inline-flex', gap: '0.5rem', background: 'var(--primary-softer)' }}>
        {[
          { id: 'results', label: 'Summary Results', icon: <TrendingUp size={16} /> },
          { id: 'analytics', label: 'Item Analytics', icon: <BarChart2 size={16} /> },
          { id: 'upload', label: 'Upload Data', icon: <Download size={16} /> }
        ].map(sub => (
          <button
            key={sub.id}
            onClick={() => setSeasonSubTab(sub.id)}
            className={`btn ${seasonSubTab === sub.id ? 'btn-primary' : 'btn-ghost'}`}
            style={{ padding: '0.6rem 1.25rem', fontSize: '0.9rem', borderRadius: '12px' }}
          >
            {sub.icon} {sub.label}
          </button>
        ))}
      </div>
      {/* Summary Results Sub-Tab */}
      {seasonSubTab === 'results' && (
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1, minWidth: '200px' }}>
              <div style={{
                background: 'var(--primary-soft)',
                color: 'var(--primary)',
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.5rem',
                border: '1px solid rgba(22, 163, 74, 0.25)'
              }}>
                📋
              </div>
              <div>
                <h2 style={{ fontSize: '1.35rem', fontWeight: '700', margin: 0, color: 'var(--text)' }}>
                  Season Results
                </h2>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-light)', margin: '0.25rem 0 0 0' }}>
                  {seasonRows.length} employee{seasonRows.length !== 1 ? 's' : ''} • Season increment summary
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={handleDownloadExcel} disabled={busy || seasonRows.length === 0} className="btn btn-secondary">
                Download Excel
              </button>
              <button onClick={handleDownloadPdf} disabled={busy || seasonRows.length === 0} className="btn btn-secondary">
                Download PDF
              </button>
            </div>
          </div>
          <div className="table-scroll-wrapper">
            <table>
              <thead>
                <tr>
                  <th className="sticky-col">Employee Name</th>
                  <th className="table-number">Sales Return Inc</th>
                  <th className="table-number">Sales Growth Inc</th>
                  <th className="table-number">NRV Inc</th>
                  <th className="table-number">Payment Collection Inc</th>
                  <th className="table-number">Season Increment</th>
                </tr>
              </thead>
              <tbody>
                {getPaginatedData(seasonRows).map((r) => (
                  <tr key={r.employeeName}>
                    <td className="sticky-col" style={{ fontWeight: '500' }}>{r.employeeName}</td>
                    <td className="table-number">{fmt(r.salesReturnInc)}</td>
                    <td className="table-number">{fmt(r.salesGrowthInc)}</td>
                    <td className="table-number">{fmt(r.nrvInc)}</td>
                    <td className="table-number">{fmt(r.paymentCollectionInc)}</td>
                    <td className="table-number" style={{ fontWeight: '600', color: 'var(--primary)' }}>
                      {fmt(r.seasonInc)}
                    </td>
                  </tr>
                ))}
                {seasonRows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="empty-state">
                      <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📂</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: '500', color: 'var(--text)', marginBottom: '0.5rem' }}>
                        No Data Available
                      </div>
                      <div style={{ fontSize: '0.95rem' }}>
                        Upload Excel files in the <b>Upload Data</b> tab to see results
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {renderPagination(seasonRows)}
        </div>
      )}

      {/* Item Analytics Sub-Tab */}
      {seasonSubTab === 'analytics' && (
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div
                style={{
                  background: 'var(--primary-soft)',
                  color: 'var(--primary)',
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.25rem',
                  border: '1px solid rgba(22, 163, 74, 0.25)',
                }}
              >
                📈
              </div>
              <div>
                <h2 style={{ fontSize: '1.2rem', fontWeight: '800', margin: 0, color: 'var(--text)' }}>Season Item Analytics</h2>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.9rem', color: 'var(--text-light)' }}>
                  {SEASONS.find((s) => s.key === tab)?.label} • Overall item performance
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                onClick={() => downloadSeasonFile(tab, 'combined')}
                className="btn btn-secondary"
                disabled={busy || !uploadedFiles[`${tab}_combined`]}
                style={{ padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}
              >
                ⬇️ Combined File
              </button>
            </div>
          </div>

          {uploadedFiles[`${tab}_combined`] ? (
            <SeasonCombinedItemAnalytics payload={combinedPayload} />
          ) : (
            <div style={{ padding: '2rem', textAlign: 'center', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '12px' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>📊</div>
              <p style={{ color: 'var(--text-light)', fontSize: '0.95rem' }}>
                Upload the <b>Combined Excel</b> in the <b>Upload Data</b> tab to generate analytics.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Upload Data Sub-Tab */}
      {seasonSubTab === 'upload' && (
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
            <div style={{
              background: 'var(--primary-soft)',
              color: 'var(--primary)',
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.5rem',
              border: '1px solid rgba(22, 163, 74, 0.25)',
              flexShrink: 0
            }}>
              📤
            </div>
            <div style={{ flex: 1, minWidth: '200px' }}>
              <h2 style={{ fontSize: '1.35rem', fontWeight: '700', margin: 0, color: 'var(--text)' }}>
                Upload Season Data
              </h2>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-light)', margin: '0.25rem 0 0 0' }}>
                Import metrics for {SEASONS.find((s) => s.key === tab)?.label} season
              </p>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
            <div className="upload-card" style={{ gridColumn: '1 / -1' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '1.2rem' }}>📊</span>
                  <label style={{ margin: 0, fontWeight: '800', fontSize: '1rem' }}>Combined Upload (Sales Return + Growth + NRV)</label>
                </div>
                <button
                  onClick={() => downloadTemplate(tab, 'combined')}
                  className="btn btn-secondary"
                  style={{
                    fontSize: '0.8rem',
                    padding: '0.4rem 0.8rem',
                    borderRadius: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    border: '1.5px solid var(--primary-soft)',
                    background: 'white',
                    color: 'var(--primary)',
                    fontWeight: '600'
                  }}
                  disabled={busy}
                >
                  📄 Get Template
                </button>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <label className="btn btn-primary" style={{ cursor: busy ? 'not-allowed' : 'pointer', fontSize: '0.85rem' }}>
                  📁 Choose File
                  <input
                    type="file" accept=".xlsx" disabled={busy} style={{ display: 'none' }}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) uploadCombined(tab, f);
                      e.currentTarget.value = '';
                    }}
                  />
                </label>
                {uploadedFiles[`${tab}_combined`] && (
                  <button onClick={() => downloadSeasonFile(tab, 'combined')} className="btn btn-secondary" disabled={busy} style={{ fontSize: '0.85rem' }}>
                    ⬇️ Download Last
                  </button>
                )}
              </div>

              <div style={{ marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px dashed var(--border)' }}>
                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-light)' }}>
                  Need to add or remove products? Go to the <b>Master Layout</b> page in the sidebar.
                </p>
              </div>
            </div>

            {METRICS.map((m) => (
              <div className="upload-card" key={m.key}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <label style={{ fontWeight: '700', fontSize: '1rem', margin: 0 }}>{m.label}</label>
                  <button
                    onClick={() => downloadTemplate(tab, m.key)}
                    className="btn btn-secondary"
                    style={{
                      fontSize: '0.75rem',
                      padding: '0.35rem 0.7rem',
                      borderRadius: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      border: '1.5px solid var(--primary-soft)',
                      background: 'white',
                      color: 'var(--primary)',
                      fontWeight: '600'
                    }}
                    disabled={busy}
                  >
                    📄 Get Template
                  </button>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <label className="btn btn-primary" style={{ cursor: busy ? 'not-allowed' : 'pointer', fontSize: '0.8rem', padding: '0.5rem 1rem' }}>
                    📁 Choose File
                    <input
                      type="file" accept=".xlsx" disabled={busy} style={{ display: 'none' }}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) uploadSeasonMetric(tab, m.key, f);
                        e.currentTarget.value = '';
                      }}
                    />
                  </label>
                  {uploadedFiles[`${tab}_${m.key}`] && (
                    <button onClick={() => downloadSeasonFile(tab, m.key)} className="btn btn-secondary" disabled={busy} style={{ fontSize: '0.8rem', padding: '0.5rem 1rem' }}>
                      ⬇️ Download Last
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
