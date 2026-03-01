import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
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
  const [year, setYear] = useState(new Date().getFullYear());
  const [years, setYears] = useState([]);
  const [yearlyRows, setYearlyRows] = useState([]);
  const [seasonRows, setSeasonRows] = useState({ shiyadu: [], unadu: [], chomasu: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [employeeName, setEmployeeName] = useState('');

  const sortedYears = useMemo(() => [...years].sort((a, b) => b - a), [years]);

  async function fetchMe() {
    try {
      const res = await api.get('/api/auth/me');
      setEmployeeName(res.data?.user?.employeeName || '');
    } catch {
      setEmployeeName('');
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

  const yearly = yearlyRows.length > 0 ? yearlyRows[0] : null;

  const seasonTable = (label, key) => {
    const rows = seasonRows[key] || [];
    return (
      <div className={`card employee-season-card employee-season-card-${key}`}>
        <div className={`employee-season-header employee-season-header-${key}`}>
          <h3>{label}</h3>
        </div>
        <table className="employee-season-table">
          <thead>
            <tr>
              <th>Employee</th>
              <th className="table-number">Sales Return Inc</th>
              <th className="table-number">Sales Growth Inc</th>
              <th className="table-number">NRV Inc</th>
              <th className="table-number">Payment Inc</th>
              <th className={`table-number employee-season-bg-${key}`}>Season Inc</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={6} className="employee-empty-state">
                <div className="employee-empty-icon-small">📊</div>
                {loading ? 'Loading...' : 'No season data available'}
              </td></tr>
            ) : rows.map((r) => (
              <tr key={r.employeeName}>
                <td className="employee-season-name-cell">{r.employeeName}</td>
                <td className="table-number">{fmt(r.salesReturnInc)}%</td>
                <td className="table-number">{fmt(r.salesGrowthInc)}%</td>
                <td className="table-number">{fmt(r.nrvInc)}%</td>
                <td className="table-number">{fmt(r.paymentCollectionInc)}%</td>
                <td className={`table-number employee-season-inc-${key}`}>
                  {fmt(r.seasonInc)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="employee-page-container">
      <div className="employee-page-content">
        
        {/* Header Card */}
        <div className="card employee-header-card">
          <div className="employee-header-content">
            <div className="employee-header-left">
              <div className="employee-avatar">
                {(employeeName || 'E').charAt(0).toUpperCase()}
              </div>
              <div className="employee-name-section">
                <h1>{employeeName || 'Employee'}</h1>
                <p>📊 Your Performance Dashboard</p>
              </div>
            </div>
            <div className="employee-header-controls">
              <select 
                value={year} 
                onChange={(e) => setYear(Number(e.target.value))} 
                disabled={loading || sortedYears.length === 0}
                className="employee-year-select"
              >
                {sortedYears.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <button className="btn employee-logout-btn" onClick={handleLogout}>
                🚪 Logout
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="alert alert-error">
            <span style={{ fontSize: '1.2rem' }}>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {/* Summary Cards */}
        <div className="employee-summary-grid">
          <div className="card employee-summary-card summary-card-gradient-1">
            <div className="employee-summary-card-icon">📈</div>
            <div className="employee-summary-card-label">Final Increment</div>
            <div className="employee-summary-card-value">{fmt(yearly?.finalIncrementPercent)}%</div>
          </div>
          <div className="card employee-summary-card summary-card-gradient-2">
            <div className="employee-summary-card-icon">🎯</div>
            <div className="employee-summary-card-label">Composite Score</div>
            <div className="employee-summary-card-value">{fmt(yearly?.compositeScore)}%</div>
          </div>
          <div className="card employee-summary-card summary-card-gradient-3">
            <div className="employee-summary-card-icon">💰</div>
            <div className="employee-summary-card-label">Base Salary</div>
            <div className="employee-summary-card-value">₹{fmt(yearly?.baseSalary)}</div>
          </div>
          <div className="card employee-summary-card summary-card-gradient-4">
            <div className="employee-summary-card-icon">💸</div>
            <div className="employee-summary-card-label">Increment Amount</div>
            <div className="employee-summary-card-value">₹{fmt(yearly?.incrementAmount)}</div>
          </div>
          <div className="card employee-summary-card summary-card-gradient-5">
            <div className="employee-summary-card-icon">💵</div>
            <div className="employee-summary-card-label">Total Salary</div>
            <div className="employee-summary-card-value">₹{fmt(yearly?.totalSalary)}</div>
          </div>
        </div>

        {/* Yearly Breakdown Table */}
        <div className="card employee-yearly-table-card">
          <div className="employee-table-header">
            <h3>
              <span className="employee-table-header-icon">📋</span>
              <span>Yearly Performance Breakdown</span>
            </h3>
          </div>
          <table className="employee-yearly-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th className="table-number">Sales Return Inc</th>
                <th className="table-number">Sales Growth Inc</th>
                <th className="table-number">NRV Inc</th>
                <th className="table-number">Payment Inc</th>
                <th className="table-number">Activity Inc</th>
                <th className="table-number employee-table-highlight-bg-green">Final Inc %</th>
                <th className="table-number">Composite Score</th>
                <th className="table-number">Base Salary</th>
                <th className="table-number">Increment</th>
                <th className="table-number employee-table-highlight-bg-blue">Total Salary</th>
              </tr>
            </thead>
            <tbody>
              {yearlyRows.length === 0 ? (
                <tr><td colSpan={11} className="employee-empty-state">
                  <div className="employee-empty-icon">📊</div>
                  {loading ? 'Loading your data...' : 'No data available'}
                </td></tr>
              ) : yearlyRows.map((r) => (
                <tr key={r.employeeName}>
                  <td className="employee-table-name-cell">{r.employeeName}</td>
                  <td className="table-number">{fmt(r.yearSalesReturnInc)}</td>
                  <td className="table-number">{fmt(r.yearSalesGrowthInc)}</td>
                  <td className="table-number">{fmt(r.yearNrvInc)}</td>
                  <td className="table-number">{fmt(r.yearPaymentCollectionInc)}</td>
                  <td className="table-number">{fmt(r.activityInc)}</td>
                  <td className="table-number employee-table-highlight-green">{fmt(r.finalIncrementPercent)}%</td>
                  <td className="table-number employee-table-composite">{fmtScore(r.compositeScore)}</td>
                  <td className="table-number">₹{fmt(r.baseSalary)}</td>
                  <td className="table-number">₹{fmt(r.incrementAmount)}</td>
                  <td className="table-number employee-table-highlight-blue">₹{fmt(r.totalSalary)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Season Data */}
        <div className="employee-season-grid">
          {seasonTable('🌱 Shiyadu Season', 'shiyadu')}
          {seasonTable('🌾 Unadu Season', 'unadu')}
          {seasonTable('🍂 Chomasu Season', 'chomasu')}
        </div>
      </div>
    </div>
  );
}