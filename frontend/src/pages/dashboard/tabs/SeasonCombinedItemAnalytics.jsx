import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';

export default function SeasonCombinedItemAnalytics({ payload }) {
  const safePayload = payload && typeof payload === 'object' ? payload : {};
  const items = Array.isArray(safePayload.items) ? safePayload.items : [];

  const fmtAmount = (v) => {
    if (v == null || Number.isNaN(v)) return '—';
    return `₹${Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const fmtPct = (v, opts = {}) => {
    const { cap = null, decimals = 2, sign = true } = opts;
    if (v == null || Number.isNaN(v)) return '—';
    const n = Number(v);
    if (!Number.isFinite(n)) return '—';
    if (cap != null && Math.abs(n) > cap) {
      const prefix = n < 0 ? '−' : (sign ? '+' : '');
      return `${prefix}${cap.toFixed(decimals)}%+`;
    }
    const prefix = n < 0 ? '' : (sign ? '+' : '');
    return `${prefix}${n.toFixed(decimals)}%`;
  };

  const top = items;

  return (
    <div>
      {!items.length ? (
        <div style={{ padding: '0.9rem', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '12px', color: 'var(--text-light)', fontSize: '0.9rem' }}>
          Analytics not generated yet. Click “↻ Refresh” to compute overall items from the uploaded file.
        </div>
      ) : (
        <div>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            <div style={{ padding: '0.6rem 0.75rem', border: '1px solid var(--border)', borderRadius: '10px', background: 'var(--bg)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-light)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Items</div>
              <div style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--text)' }}>{items.length}</div>
            </div>
            <div style={{ padding: '0.6rem 0.75rem', border: '1px solid var(--border)', borderRadius: '10px', background: 'var(--bg)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-light)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Employees (sheets)</div>
              <div style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--text)' }}>{safePayload.employeesProcessed ?? '—'}</div>
            </div>
          </div>

          <div style={{ marginBottom: '1.5rem', background: 'var(--surface)', padding: '2rem', borderRadius: '20px', border: '1px solid var(--primary-soft)', boxShadow: 'var(--shadow-xl)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
              <div>
                <h3 style={{ fontWeight: '800', color: 'var(--text)', fontSize: '1.35rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ fontSize: '1.5rem' }}>📊</span> Item Performance Graph
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-light)', margin: '0.35rem 0 0 0' }}>Showing all {top.length} items (Bars adjust size automatically)</p>
              </div>
            </div>

            <div style={{
              width: '100%',
              height: '450px',
              padding: '1rem',
              background: 'rgba(255,255,255,0.3)',
              borderRadius: '16px',
              border: '1px solid var(--border)'
            }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={top} margin={{ top: 20, right: 20, left: 20, bottom: 90 }}>
                  <defs>
                    <linearGradient id="barGradientVerticalFixed" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--primary)" stopOpacity={1} />
                      <stop offset="100%" stopColor="var(--primary-dark)" stopOpacity={0.8} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.4} />
                  <XAxis
                    dataKey="productName"
                    angle={-45}
                    textAnchor="end"
                    interval={top.length > 20 ? 'preserveStartEnd' : 0}
                    height={100}
                    stroke="var(--text)"
                    fontSize={top.length > 30 ? 10 : 12}
                    fontWeight={600}
                  />
                  <YAxis
                    tickFormatter={(v) => {
                      if (v >= 10000000) return `₹${(v / 10000000).toFixed(1)}Cr`;
                      if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
                      return `₹${(v / 1000).toFixed(0)}k`;
                    }}
                    stroke="var(--text-light)"
                    fontSize={11}
                    width={60}
                  />
                  <RechartsTooltip
                    formatter={(value) => [`₹${Number(value).toLocaleString('en-IN')}`, 'Total Sale']}
                    contentStyle={{
                      backgroundColor: 'rgba(255, 255, 255, 0.95)',
                      backdropFilter: 'blur(10px)',
                      borderRadius: '16px',
                      border: '1px solid var(--primary-soft)',
                      boxShadow: '0 12px 30px rgba(0,0,0,0.12)',
                      padding: '12px 16px',
                      zIndex: 100
                    }}
                    itemStyle={{ color: 'var(--primary)', fontWeight: 800, fontSize: '1.1rem' }}
                    labelStyle={{ color: 'var(--text)', fontWeight: 700, marginBottom: '4px' }}
                    cursor={{ fill: 'var(--primary-softer)', opacity: 0.3 }}
                  />
                  <Bar
                    dataKey="totalAmount"
                    fill="url(#barGradientVerticalFixed)"
                    radius={[6, 6, 0, 0]}
                    barSize={top.length > 40 ? 10 : top.length > 20 ? 20 : 40}
                  >
                    {top.map((entry, index) => (
                      <Cell key={`cell-${index}`} fillOpacity={1 - (index * 0.01)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: '12px' }}>
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, minWidth: '760px' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>Item</th>
                  <th style={{ textAlign: 'right' }}>Total Sale</th>
                  <th style={{ textAlign: 'right' }}>Last Year</th>
                  <th style={{ textAlign: 'right' }}>Growth</th>
                  <th style={{ textAlign: 'right' }}>Avg SR%</th>
                  <th style={{ textAlign: 'right' }}>Avg Net Rate</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.productKey || it.productName}>
                    <td style={{ fontWeight: '800', color: 'var(--text)' }}>{it.productName}</td>
                    <td style={{ textAlign: 'right', fontWeight: '900' }}>{fmtAmount(it.totalAmount)}</td>
                    <td style={{ textAlign: 'right' }}>{fmtAmount(it.lastYearAmount)}</td>
                    <td style={{ textAlign: 'right', color: it.growthPercent != null && Number(it.growthPercent) < 0 ? 'var(--danger)' : 'var(--text)' }}>
                      {fmtPct(it.growthPercent, { cap: 9999 })}
                    </td>
                    <td style={{ textAlign: 'right' }}>{it.avgSRPercent == null ? '—' : `${Number(it.avgSRPercent).toFixed(2)}%`}</td>
                    <td style={{ textAlign: 'right' }}>{it.avgNetRate == null ? '—' : Number(it.avgNetRate).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
