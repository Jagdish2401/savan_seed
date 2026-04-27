import { MONTHS } from '../constants.js';

export default function MonthlyTab({
  busy,
  abMonth,
  setAbMonth,
  monthlyRows,
  getPaginatedData,
  fmt,
  renderPagination,
  downloadTemplate,
  uploadYearly,
  handleDownloadExcel,
  handleDownloadPdf,
}) {
  return (
    <div>
      <div className="card" style={{ marginBottom: '1.5rem' }}>
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
            border: '1px solid rgba(22, 163, 74, 0.25)'
          }}>
            📤
          </div>
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: '1.35rem', fontWeight: '700', margin: 0, color: 'var(--text)' }}>
              Upload Monthly Data
            </h2>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-light)', margin: '0.25rem 0 0 0' }}>
              Upload activity metrics for each month
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.95rem', fontWeight: '500' }}>
            <span>🗓️ Month:</span>
            <select
              className="select input-sm"
              value={abMonth}
              disabled={busy}
              onChange={(e) => setAbMonth(Number(e.target.value))}
              style={{ width: '180px' }}
            >
              {MONTHS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
          <div style={{ fontSize: '0.875rem', color: 'var(--text-light)' }}>
            Selected month is used for both uploads
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
          <div className="upload-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <label style={{ fontWeight: '700', fontSize: '1rem', margin: 0 }}>Activity %</label>
              <button
                onClick={() => downloadTemplate('yearly', 'activity')}
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
              <label className="btn btn-primary" style={{ cursor: busy ? 'not-allowed' : 'pointer', fontSize: '0.85rem', padding: '0.5rem 1.25rem' }}>
                📁 Choose File
                <input
                  type="file" accept=".xlsx" disabled={busy} style={{ display: 'none' }}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) uploadYearly('activity', f);
                    e.currentTarget.value = '';
                  }}
                />
              </label>
            </div>
          </div>
        </div>
      </div>

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
              border: '1px solid rgba(22, 163, 74, 0.25)',
              flexShrink: 0
            }}>
              📋
            </div>
            <div>
              <h2 style={{ fontSize: '1.35rem', fontWeight: '700', margin: 0, color: 'var(--text)' }}>
                Monthly Results
              </h2>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-light)', margin: '0.25rem 0 0 0' }}>
                {MONTHS.find((m) => m.value === abMonth)?.label} • {monthlyRows.length} employee{monthlyRows.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              onClick={() => downloadTemplate(null, 'activity')}
              className="btn btn-secondary"
              style={{ background: 'white', color: 'var(--primary)', border: '1.5px solid var(--primary-soft)' }}
            >
              📄 Get Template
            </button>
            <button onClick={handleDownloadExcel} disabled={busy || monthlyRows.length === 0} className="btn btn-secondary">
              Download Excel
            </button>
            <button onClick={handleDownloadPdf} disabled={busy || monthlyRows.length === 0} className="btn btn-secondary">
              Download PDF
            </button>
          </div>
        </div>

        <div className="alert alert-warning" style={{ marginBottom: '1rem' }}>
          <span style={{ fontSize: '1.2rem' }}>ℹ️</span>
          <span>Employees missing this month’s upload show as <b>0%</b>.</span>
        </div>

        <div className="table-scroll-wrapper">
          <table>
            <thead>
              <tr>
                <th className="sticky-col">Employee</th>
                <th className="table-number">Activity %</th>
              </tr>
            </thead>
            <tbody>
              {getPaginatedData(monthlyRows).map((r) => (
                <tr key={r.employeeName}>
                  <td className="sticky-col" style={{ fontWeight: '500' }}>{r.employeeName}</td>
                  <td className="table-number">{fmt(r.activityPct)}</td>
                </tr>
              ))}
              {monthlyRows.length === 0 && (
                <tr>
                  <td colSpan={2} className="empty-state">
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📂</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: '500', color: 'var(--text)', marginBottom: '0.5rem' }}>
                      No Monthly Data
                    </div>
                    <div style={{ fontSize: '0.95rem' }}>
                      Upload Activity for this month to update results
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {renderPagination(monthlyRows)}
      </div>
    </div>
  );
}
