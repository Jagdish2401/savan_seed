import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Lock, CheckCircle } from 'lucide-react';
import './EmployeePage.css';

function fmt(v) {
  if (v == null || Number.isNaN(v)) return '—';
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  return n.toFixed(2);
}

function fmtScore(v) {
  if (v == null || Number.isNaN(v)) return '—';
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  return `${n.toFixed(2)}%`;
}

export default function EmployeePage({ onLogout }) {
  const navigate = useNavigate();
  const [year, setYear] = useState(new Date().getFullYear());
  const [years, setYears] = useState([]);
  const [yearlyRows, setYearlyRows] = useState([]);
  const [seasonRows, setSeasonRows] = useState({ shiyadu: [], unadu: [], chomasu: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [employeeName, setEmployeeName] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [showPwdModal, setShowPwdModal] = useState(false);
  const [pwdData, setPwdData] = useState({ current: '', new: '', confirm: '' });
  const [pwdBusy, setPwdBusy] = useState(false);
  const [pwdMsg, setPwdMsg] = useState(null);
  const [pwdError, setPwdError] = useState(null);
  const [showPwd, setShowPwd] = useState({ current: false, new: false, confirm: false });

  const sortedYears = useMemo(() => [...years].sort((a, b) => b - a), [years]);

  async function fetchMe() {
    try {
      const res = await api.get('/api/auth/me');
      setEmployeeName(res.data?.user?.employeeName || '');
      setEmployeeId(res.data?.user?.employeeId || '');
    } catch {
      setEmployeeName('');
      setEmployeeId('');
    }
  }

  async function fetchYears() {
    try {
      const res = await api.get('/api/increments/years');
      const ys = Array.isArray(res.data?.years) ? res.data.years : [];
      setYears(ys);
      if (ys.length > 0) {
        setYear((prev) => (ys.includes(prev) ? prev : ys[0]));
      }
    } catch (e) {
      setYears([]);
      setError(e?.response?.data?.message || e?.message || 'Failed to load years');
    }
  }

  async function fetchYearly(targetYear) {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/api/increments/${targetYear}/yearly`);
      const data = Array.isArray(res.data?.rows) ? res.data.rows : [];
      const withScore = data.map((r) => ({
        ...r,
        compositeScore: typeof r.finalIncrementPercent === 'number' && Number.isFinite(r.finalIncrementPercent)
          ? Math.max(0, Math.min(100, (r.finalIncrementPercent / 18) * 100))
          : null,
      }));
      setYearlyRows(withScore);
    } catch (e) {
      setYearlyRows([]);
      setError(e?.response?.data?.message || e?.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }

  async function fetchSeasons(targetYear) {
    try {
      const [sh, un, ch] = await Promise.all([
        api.get(`/api/increments/${targetYear}/seasons/shiyadu`),
        api.get(`/api/increments/${targetYear}/seasons/unadu`),
        api.get(`/api/increments/${targetYear}/seasons/chomasu`),
      ]);
      setSeasonRows({
        shiyadu: sh.data?.rows || [],
        unadu: un.data?.rows || [],
        chomasu: ch.data?.rows || [],
      });
    } catch (e) {
      setSeasonRows({ shiyadu: [], unadu: [], chomasu: [] });
      setError(e?.response?.data?.message || e?.message || 'Failed to load season data');
    }
  }

  // Fetch initial data only once on mount (no auto-refresh)
  useEffect(() => {
    fetchMe().catch(() => {});
    fetchYears().catch(() => {});
  }, []);

  // Fetch data only when year changes (no auto-refresh)
  useEffect(() => {
    if (year) {
      fetchYearly(year).catch(() => {});
      fetchSeasons(year).catch(() => {});
    }
  }, [year]);

  async function handleLogout() {
    try {
      await api.post('/api/auth/logout');
      if (onLogout) onLogout();
    } catch {
      if (onLogout) onLogout();
    }
  }

  async function handlePasswordChange(e) {
    e.preventDefault();
    setPwdError(null);
    setPwdMsg(null);
    
    if (pwdData.new !== pwdData.confirm) {
      setPwdError('New passwords do not match');
      return;
    }
    if (pwdData.new.length < 6) {
      setPwdError('Password must be at least 6 characters');
      return;
    }

    setPwdBusy(true);
    try {
      await api.post('/api/auth/change-password', {
        currentPassword: pwdData.current,
        newPassword: pwdData.new
      });
      setPwdMsg('Password updated successfully! Redirecting...');
      setPwdData({ current: '', new: '', confirm: '' });
      setTimeout(() => {
        setShowPwdModal(false);
        navigate('/');
      }, 2000);
    } catch (err) {
      setPwdError(err.response?.data?.message || 'Failed to change password');
    } finally {
      setPwdBusy(false);
    }
  }

  const yearly = yearlyRows.length > 0 ? yearlyRows[0] : null;


  return (
    <div className="fade-in">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span>My Performance</span>
            {employeeId && (
              <span style={{ fontSize: '0.85rem', background: 'var(--primary-soft)', color: 'var(--primary)', padding: '0.25rem 0.6rem', borderRadius: '8px', fontWeight: 700 }}>
                {employeeId}
              </span>
            )}
          </h2>
          <p style={{ color: 'var(--text-light)', fontSize: '0.95rem', marginTop: '0.25rem', fontWeight: 500 }}>
            Welcome, <span style={{ color: 'var(--text)', fontWeight: 700 }}>{employeeName || 'Employee'}</span> 👋
          </p>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <button 
            onClick={() => {
              setPwdMsg(null);
              setPwdError(null);
              setPwdData({ current: '', new: '', confirm: '' });
              setShowPwdModal(true);
            }}
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}
          >
            <span>🔒</span> Change Password
          </button>
          <select 
            value={year} 
            onChange={(e) => setYear(Number(e.target.value))} 
            disabled={loading || sortedYears.length === 0}
            className="select input-sm"
            style={{ width: '120px', fontWeight: 600 }}
          >
            {sortedYears.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Change Password Modal */}
      {showPwdModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, backdropFilter: 'blur(4px)'
        }} onClick={() => !pwdBusy && setShowPwdModal(false)}>
          <div className="card" style={{ width: '400px', maxWidth: '90%', padding: '2rem' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 1.5rem 0', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontSize: '1.5rem' }}>🔐</span> Change Password
            </h3>
            
            {pwdMsg && <div className="alert alert-success" style={{ marginBottom: '1rem', padding: '0.75rem' }}>{pwdMsg}</div>}
            {pwdError && <div className="alert alert-error" style={{ marginBottom: '1rem', padding: '0.75rem' }}>{pwdError}</div>}

            <form onSubmit={handlePasswordChange}>
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem' }}>Current Password</label>
                <div style={{ position: 'relative' }}>
                  <input 
                    type={showPwd.current ? "text" : "password"} className="input" required
                    value={pwdData.current}
                    onChange={e => setPwdData(p => ({ ...p, current: e.target.value }))}
                    placeholder="••••••••"
                    disabled={pwdBusy}
                    style={{ paddingRight: '2.5rem' }}
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowPwd(p => ({ ...p, current: !p.current }))}
                    style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', color: 'var(--text-light)', cursor: 'pointer', display: 'flex' }}
                  >
                    {showPwd.current ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem' }}>New Password</label>
                <div style={{ position: 'relative' }}>
                  <input 
                    type={showPwd.new ? "text" : "password"} className="input" required
                    value={pwdData.new}
                    onChange={e => setPwdData(p => ({ ...p, new: e.target.value }))}
                    placeholder="Min 6 characters"
                    disabled={pwdBusy}
                    style={{ paddingRight: '2.5rem' }}
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowPwd(p => ({ ...p, new: !p.new }))}
                    style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', color: 'var(--text-light)', cursor: 'pointer', display: 'flex' }}
                  >
                    {showPwd.new ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div style={{ marginBottom: '2rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem' }}>Confirm New Password</label>
                <div style={{ position: 'relative' }}>
                  <input 
                    type={showPwd.confirm ? "text" : "password"} className="input" required
                    value={pwdData.confirm}
                    onChange={e => setPwdData(p => ({ ...p, confirm: e.target.value }))}
                    placeholder="Re-type new password"
                    disabled={pwdBusy}
                    style={{ paddingRight: '2.5rem' }}
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowPwd(p => ({ ...p, confirm: !p.confirm }))}
                    style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', color: 'var(--text-light)', cursor: 'pointer', display: 'flex' }}
                  >
                    {showPwd.confirm ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button type="button" className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setShowPwdModal(false)} disabled={pwdBusy}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 2 }} disabled={pwdBusy}>
                  {pwdBusy ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

        {error && (
          <div className="alert alert-error">
            <span style={{ fontSize: '1.2rem' }}>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {/* Summary Cards */}
        <div className="metrics-grid">
          <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ background: 'var(--primary-soft)', color: 'var(--primary)', padding: '1rem', borderRadius: '16px', fontSize: '1.5rem' }}>📈</div>
            <div>
              <div style={{ fontSize: '0.875rem', color: 'var(--text-light)', fontWeight: 600 }}>Final Increment</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text)' }}>{fmt(yearly?.finalIncrementPercent)}%</div>
            </div>
          </div>
          <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ background: 'var(--primary-soft)', color: 'var(--primary)', padding: '1rem', borderRadius: '16px', fontSize: '1.5rem' }}>🎯</div>
            <div>
              <div style={{ fontSize: '0.875rem', color: 'var(--text-light)', fontWeight: 600 }}>Composite Score</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text)' }}>{fmt(yearly?.compositeScore)}%</div>
            </div>
          </div>
          <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ background: 'var(--primary-soft)', color: 'var(--primary)', padding: '1rem', borderRadius: '16px', fontSize: '1.5rem' }}>💰</div>
            <div>
              <div style={{ fontSize: '0.875rem', color: 'var(--text-light)', fontWeight: 600 }}>Base Salary</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text)' }}>₹{fmt(yearly?.baseSalary)}</div>
            </div>
          </div>
          <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ background: 'var(--primary-soft)', color: 'var(--primary)', padding: '1rem', borderRadius: '16px', fontSize: '1.5rem' }}>💸</div>
            <div>
              <div style={{ fontSize: '0.875rem', color: 'var(--text-light)', fontWeight: 600 }}>Increment Amount</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--primary)' }}>+₹{fmt(yearly?.incrementAmount)}</div>
            </div>
          </div>
        </div>

        {/* Yearly Breakdown Table */}
        <div className="card" style={{ marginBottom: '2rem' }}>
          <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ background: 'var(--primary-soft)', color: 'var(--primary)', padding: '0.5rem', borderRadius: '10px' }}>📋</div>
            <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>Yearly Performance</h3>
          </div>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Sales Return Inc</th>
                  <th>Sales Growth Inc</th>
                  <th>NRV Inc</th>
                  <th>Payment Inc</th>
                  <th>Activity Inc</th>
                  <th style={{ color: 'var(--primary)' }}>Final Inc %</th>
                  <th style={{ color: 'var(--primary)' }}>Total Salary</th>
                </tr>
              </thead>
              <tbody>
                {yearlyRows.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-light)' }}>
                    {loading ? 'Loading your data...' : 'No data available'}
                  </td></tr>
                ) : yearlyRows.map((r) => (
                  <tr key={r.employeeName}>
                    <td>{fmt(r.yearSalesReturnInc)}</td>
                    <td>{fmt(r.yearSalesGrowthInc)}</td>
                    <td>{fmt(r.yearNrvInc)}</td>
                    <td>{fmt(r.yearPaymentCollectionInc)}</td>
                    <td>{fmt(r.activityInc)}</td>
                    <td style={{ fontWeight: 700, color: 'var(--primary)' }}>{fmt(r.finalIncrementPercent)}%</td>
                    <td style={{ fontWeight: 700, color: 'var(--primary)' }}>₹{fmt(r.totalSalary)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Season Data Consolidated Table */}
        <div className="card" style={{ marginBottom: '2rem' }}>
          <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ background: 'var(--primary-soft)', color: 'var(--primary)', padding: '0.5rem', borderRadius: '10px' }}>🗓️</div>
            <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>Seasonal Breakdown</h3>
          </div>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Season</th>
                  <th>Sales Return Inc</th>
                  <th>Sales Growth Inc</th>
                  <th>NRV Inc</th>
                  <th>Payment Inc</th>
                  <th style={{ color: 'var(--primary)' }}>Season Inc</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { label: '🌱 Shiyadu', key: 'shiyadu' },
                  { label: '🌾 Unadu', key: 'unadu' },
                  { label: '🍂 Chomasu', key: 'chomasu' }
                ].map((s) => {
                  const row = (seasonRows[s.key] || [])[0];
                  return (
                    <tr key={s.key}>
                      <td style={{ fontWeight: 600 }}>{s.label}</td>
                      <td>{row ? `${fmt(row.salesReturnInc)}%` : '—'}</td>
                      <td>{row ? `${fmt(row.salesGrowthInc)}%` : '—'}</td>
                      <td>{row ? `${fmt(row.nrvInc)}%` : '—'}</td>
                      <td>{row ? `${fmt(row.paymentCollectionInc)}%` : '—'}</td>
                      <td style={{ fontWeight: 700, color: 'var(--primary)' }}>
                        {row ? `${fmt(row.seasonInc)}%` : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
    </div>
  );
}