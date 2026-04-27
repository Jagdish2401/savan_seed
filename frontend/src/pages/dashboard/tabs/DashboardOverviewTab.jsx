import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { fmtScore } from '../format.js';

export default function DashboardOverviewTab({ year, dashboardStats, yearlyRowsView, allSeasonsItems }) {
  return (
    <div>
      {/* Key Metrics Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        <div className="card" style={{ padding: '1.5rem', background: 'var(--surface)', borderLeft: '4px solid var(--primary)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{
              background: 'var(--primary-soft)',
              color: 'var(--primary)',
              width: '60px',
              height: '60px',
              borderRadius: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '2rem',
              border: '1px solid rgba(22, 163, 74, 0.25)'
            }}>
              👥
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-light)', margin: 0, fontWeight: '500' }}>Total Employees</p>
              <h3 style={{ fontSize: '2.5rem', fontWeight: '700', margin: 0, color: 'var(--text)' }}>{dashboardStats.totalEmployees}</h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-light)', margin: 0, marginTop: '0.25rem' }}>Active in {year}</p>
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: '1.5rem', background: 'var(--surface)', borderLeft: '4px solid var(--primary)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{
              background: 'var(--primary-soft)',
              color: 'var(--primary)',
              width: '60px',
              height: '60px',
              borderRadius: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '2rem',
              border: '1px solid rgba(22, 163, 74, 0.25)'
            }}>
              📈
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-light)', margin: 0, fontWeight: '500' }}>Avg Increment</p>
              <h3 style={{ fontSize: '2.5rem', fontWeight: '700', margin: 0, color: 'var(--primary)' }}>{dashboardStats.avgFinalIncrement}%</h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-light)', margin: 0, marginTop: '0.25rem' }}>Max possible: 18%</p>
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: '1.5rem', background: 'var(--surface)', borderLeft: '4px solid var(--primary)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{
              background: 'var(--primary-soft)',
              color: 'var(--primary)',
              width: '60px',
              height: '60px',
              borderRadius: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '2rem',
              border: '1px solid rgba(22, 163, 74, 0.25)'
            }}>
              🏆
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-light)', margin: 0, fontWeight: '500' }}>Top Performer</p>
              <h3 style={{ fontSize: '1.5rem', fontWeight: '700', margin: 0, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {(() => {
                  const top = [...yearlyRowsView].sort((a, b) => (b.adjustedFinalIncrement || 0) - (a.adjustedFinalIncrement || 0))[0];
                  return top ? top.employeeName : 'N/A';
                })()}
              </h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-light)', margin: 0, marginTop: '0.25rem' }}>
                {(() => {
                  const top = [...yearlyRowsView]
                    .sort((a, b) => (b.adjustedFinalIncrement || 0) - (a.adjustedFinalIncrement || 0))[0];
                  const inc = top ? (top.adjustedFinalIncrement || 0).toFixed(2) : null;
                  return top ? `${inc}% increment` : 'No data';
                })()}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Analytics Grid */}

      {/* Additional Analytics Modules */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem' }}>
        {/* Top Performers List */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <div style={{
              background: 'var(--primary-soft)',
              color: 'var(--primary)',
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.25rem',
              border: '1px solid rgba(22, 163, 74, 0.25)'
            }}>
              🏅
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: '600', margin: 0, color: 'var(--text)' }}>
              Top 5 Performers
            </h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {(() => {
              const top5 = [...yearlyRowsView]
                .filter(r => r.adjustedFinalIncrement != null)
                .sort((a, b) => (b.adjustedFinalIncrement || 0) - (a.adjustedFinalIncrement || 0))
                .slice(0, 5);

              if (top5.length === 0) {
                return (
                  <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-light)' }}>
                    <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📊</div>
                    <p style={{ margin: 0 }}>No performance data available</p>
                  </div>
                );
              }

              const medals = ['🥇', '🥈', '🥉', '🎖️', '🎖️'];
              return top5.map((emp, idx) => (
                <div key={emp.employeeName} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.75rem',
                  background: idx === 0 ? 'var(--primary-softer)' : 'var(--bg)',
                  borderRadius: '8px',
                  border: `1px solid ${idx === 0 ? 'rgba(22, 163, 74, 0.25)' : 'var(--border)'}`,
                  transition: 'box-shadow 0.2s ease',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: '1.5rem' }}>{medals[idx]}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontWeight: '600', fontSize: '0.95rem', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {emp.employeeName}
                      </p>
                      <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-light)' }}>
                        Score: {fmtScore(emp.compositeScore)}
                      </p>
                    </div>
                  </div>
                  <div style={{
                    background: idx === 0 ? 'var(--primary)' : 'var(--primary-soft)',
                    color: idx === 0 ? 'white' : 'var(--primary-dark)',
                    padding: '0.375rem 0.75rem',
                    borderRadius: '6px',
                    fontWeight: '700',
                    fontSize: '0.875rem',
                    border: idx === 0 ? '1px solid rgba(22, 163, 74, 0.25)' : '1px solid rgba(22, 163, 74, 0.2)'
                  }}>
                    {(emp.adjustedFinalIncrement || 0).toFixed(2)}%
                  </div>
                </div>
              ));
            })()}
          </div>
        </div>

        {/* Increment Distribution */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <div style={{
              background: 'var(--primary-soft)',
              color: 'var(--primary)',
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.25rem',
              border: '1px solid rgba(22, 163, 74, 0.25)'
            }}>
              📊
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: '600', margin: 0, color: 'var(--text)' }}>
              Increment Distribution
            </h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', alignItems: 'center' }}>
            {(() => {
              const ranges = [
                { name: '0-5%', min: 0, max: 5, color: '#ef4444' },
                { name: '5-10%', min: 5, max: 10, color: '#f59e0b' },
                { name: '10-15%', min: 10, max: 15, color: '#10b981' },
                { name: '15-18%', min: 15, max: 18.01, color: '#059669' }
              ];
              const data = ranges.map(range => {
                const count = yearlyRowsView.filter(r => {
                  const inc = r.adjustedFinalIncrement ?? 0;
                  return inc >= range.min && inc < range.max;
                }).length;
                return { name: range.name, value: count, color: range.color };
              }).filter(d => d.value > 0);

              if (data.length === 0) {
                return <div style={{ padding: '2rem', color: 'var(--text-light)' }}>No distribution data</div>;
              }

              return (
                <div style={{ width: '100%', height: '280px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data}
                        cx="50%"
                        cy="50%"
                        innerRadius={70}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {data.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <RechartsTooltip
                        contentStyle={{ backgroundColor: 'var(--glass-bg)', backdropFilter: 'blur(8px)', borderRadius: '12px', border: '1px solid var(--glass-border)' }}
                        itemStyle={{ color: 'var(--text)', fontWeight: 700 }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '1rem', flexWrap: 'wrap' }}>
                    {data.map(entry => (
                      <div key={entry.name} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-light)' }}>
                        <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: entry.color }} />
                        {entry.name}: {entry.value}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Overall Item Analytics (Combined All Seasons) */}
      <div className="card" style={{ marginTop: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              background: 'var(--primary-soft)',
              color: 'var(--primary)',
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.25rem',
              border: '1px solid rgba(22, 163, 74, 0.25)'
            }}>
              📈
            </div>
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: '800', margin: 0, color: 'var(--text)' }}>
                Overall Product Performance (All Seasons)
              </h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-light)', margin: 0 }}>
                Aggregate sales amount per product across Shiyadu, Unadu, and Chomasu
              </p>
            </div>
          </div>
        </div>

        {allSeasonsItems.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--text-light)', background: 'var(--bg)', borderRadius: '16px', border: '1px dashed var(--border)' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📊</div>
            <h4 style={{ color: 'var(--text)', marginBottom: '0.5rem' }}>No Aggregate Data Yet</h4>
            <p style={{ margin: 0 }}>Upload combined season data to see product-level insights here.</p>
          </div>
        ) : (
          <>
            <div style={{ paddingBottom: '1rem' }}>
              <div style={{
                height: '450px',
                width: '100%'
              }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={allSeasonsItems}
                    margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                    <XAxis
                      dataKey="productName"
                      interval={0}
                      angle={-45}
                      textAnchor="end"
                      height={80}
                      tick={{ fill: 'var(--text)', fontSize: 11, fontWeight: 600 }}
                    />
                    <YAxis
                      tickFormatter={(v) => `₹${(v / 100000).toFixed(0)}L`}
                      stroke="var(--text-light)"
                      fontSize={12}
                      fontWeight={500}
                    />
                    <RechartsTooltip
                      contentStyle={{
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        borderRadius: '12px',
                        border: '1px solid var(--primary-soft)',
                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                        backdropFilter: 'blur(4px)'
                      }}
                      formatter={(value) => [`₹${value.toLocaleString('en-IN')}`, 'Total Sales']}
                    />
                    <Bar
                      dataKey="totalAmount"
                      fill="var(--primary)"
                      radius={[4, 4, 0, 0]}
                    >
                      {allSeasonsItems.map((entry, index) => (
                        <Cell key={`cell-${index}`} fillOpacity={0.8 + (index % 2) * 0.2} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div style={{ marginTop: '2rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
              {allSeasonsItems.slice(0, 4).map((item, idx) => (
                <div key={item.productKey} style={{
                  padding: '1rem',
                  background: 'var(--bg)',
                  borderRadius: '12px',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.25rem'
                }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    #{idx + 1} Product
                  </span>
                  <span style={{ fontWeight: '700', color: 'var(--text)', fontSize: '0.95rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.productName}
                  </span>
                  <span style={{ color: 'var(--primary)', fontWeight: '800', fontSize: '1.1rem' }}>
                    ₹{item.totalAmount.toLocaleString('en-IN')}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
