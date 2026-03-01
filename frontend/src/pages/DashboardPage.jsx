import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import {
  downloadExcel,
  downloadExcelWorkbookMixed,
  downloadPdf,
  downloadPdfSections,
} from '../utils/export';

const SEASONS = [
  { key: 'shiyadu', label: 'Shiyadu' },
  { key: 'unadu', label: 'Unadu' },
  { key: 'chomasu', label: 'Chomasu' },
];

const METRICS = [
  { key: 'paymentCollection', label: 'Payment Collection' },
];

const MONTHS = [
  { value: 1, label: 'January', short: 'Jan' },
  { value: 2, label: 'February', short: 'Feb' },
  { value: 3, label: 'March', short: 'Mar' },
  { value: 4, label: 'April', short: 'Apr' },
  { value: 5, label: 'May', short: 'May' },
  { value: 6, label: 'June', short: 'Jun' },
  { value: 7, label: 'July', short: 'Jul' },
  { value: 8, label: 'August', short: 'Aug' },
  { value: 9, label: 'September', short: 'Sep' },
  { value: 10, label: 'October', short: 'Oct' },
  { value: 11, label: 'November', short: 'Nov' },
  { value: 12, label: 'December', short: 'Dec' },
];

function fmt(v) {
  if (v == null || Number.isNaN(v)) return '—';
  return `${Number(v).toFixed(2)}%`;
}

function clamp01to100(v) {
  return Math.max(0, Math.min(100, v));
}

function fmtScore(v) {
  if (v == null || Number.isNaN(v)) return '—';
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  return n.toFixed(2);
}

function toNumOrZero(v) {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

function inc18ToCompositeScore(inc18) {
  if (inc18 == null || Number.isNaN(inc18)) return null;
  const n = Number(inc18);
  if (!Number.isFinite(n)) return null;
  return clamp01to100((n / 18) * 100);
}

function augmentYearlyRowsWithPartialFromSeasons(strictYearlyRows, seasonsByKey) {
  const seasonsByEmployee = new Map();
  for (const seasonKey of ['shiyadu', 'unadu', 'chomasu']) {
    for (const r of (seasonsByKey?.[seasonKey] || [])) {
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
    const partialYearNrvInc =
      (getSeasonInc('shiyadu', 'nrvInc') + getSeasonInc('unadu', 'nrvInc') + getSeasonInc('chomasu', 'nrvInc')) / 3;
    const partialYearPaymentCollectionInc =
      (getSeasonInc('shiyadu', 'paymentCollectionInc') +
        getSeasonInc('unadu', 'paymentCollectionInc') +
        getSeasonInc('chomasu', 'paymentCollectionInc')) /
      3;

    const activityInc = toNumOrZero(r.activityInc);

    // Partial final increment: missing dependencies treated as 0.
    const partialFinalIncrementPercent =
      (partialYearSalesReturnInc +
        partialYearSalesGrowthInc +
        partialYearNrvInc +
        partialYearPaymentCollectionInc +
        activityInc) /
      5;

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

function fmtCurrency(v) {
  if (v == null || Number.isNaN(v) || v === 0) return '—';
  return `₹${Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtCurrencyForExport(v) {
  if (v == null || Number.isNaN(v)) return '0.00';
  const num = Number(v);
  return num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function todayDatePart() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}

export default function DashboardPage({ onLogout }) {
  const navigate = useNavigate();
  const [year, setYear] = useState(new Date().getFullYear());
  const [availableYears, setAvailableYears] = useState([]);
  const [showAddYearModal, setShowAddYearModal] = useState(false);
  const [newYear, setNewYear] = useState('');
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved === 'true';
  });
  const [tab, setTab] = useState('dashboard');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);

  const [abMonth, setAbMonth] = useState(new Date().getMonth() + 1);

  const [seasonRows, setSeasonRows] = useState([]);
  const [monthlyRows, setMonthlyRows] = useState([]);
  const [yearlyRows, setYearlyRows] = useState([]);
  const [behaviourOverrides, setBehaviourOverrides] = useState({}); // whether bonus applied (backend state)
  const [behaviourConfirmed, setBehaviourConfirmed] = useState({}); // lock UI after yes
  const [dashboardStats, setDashboardStats] = useState({
    totalEmployees: 0,
    avgFinalIncrement: 0,
    totalSalaryBudget: 0,
    avgCompositeScore: 0,
    dataCompleteness: 0
  });

  const [baseSalaryEdits, setBaseSalaryEdits] = useState({});

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 1000;

  // Uploaded files state
  const [uploadedFiles, setUploadedFiles] = useState({});

  const canEditBaseSalary = useMemo(() => {
    const m = {};
    for (const r of yearlyRows) {
      m[r.employeeName] = r.baseSalarySource === 'manual';
    }
    return m;
  }, [yearlyRows]);

  async function handleLogout() {
    try {
      await api.post('/api/auth/logout');
      if (onLogout) onLogout();
      navigate('/login');
    } catch (err) {
      console.error('Logout failed', err);
    }
  }

  async function handleBehaviourYes(name) {
    if (behaviourConfirmed[name]) return;
    const ok = window.confirm('Are you sure you want to add +1% to final increment for this employee? This cannot be removed.');
    if (!ok) return;
    try {
      await api.post(`/api/increments/${year}/behaviour-bonus`, [{ employeeName: name, apply: true }]);
      setMessage('Behaviour bonus applied (+1%)');
      setBehaviourOverrides((prev) => ({ ...prev, [name]: true }));
      setBehaviourConfirmed((prev) => ({ ...prev, [name]: true }));
      await loadYearly();
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Failed to apply behaviour bonus');
    }
  }

  async function handleBehaviourNo(name) {
    if (behaviourConfirmed[name]) return;
    try {
      await api.post(`/api/increments/${year}/behaviour-bonus`, [{ employeeName: name, apply: false }]);
      setBehaviourOverrides((prev) => ({ ...prev, [name]: false }));
      setMessage('Behaviour bonus left unchanged');
      await loadYearly();
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Failed to update');
    }
  }

  async function loadSeason(season) {
    const res = await api.get(`/api/increments/${year}/seasons/${season}`);
    setSeasonRows(res.data.rows || []);
  }

  async function loadYearly() {
    const [yearlyRes, shiyaduRes, unaduRes, chomasuRes] = await Promise.all([
      api.get(`/api/increments/${year}/yearly`),
      api.get(`/api/increments/${year}/seasons/shiyadu`),
      api.get(`/api/increments/${year}/seasons/unadu`),
      api.get(`/api/increments/${year}/seasons/chomasu`),
    ]);

    const seasonsByKey = {
      shiyadu: shiyaduRes?.data?.rows || [],
      unadu: unaduRes?.data?.rows || [],
      chomasu: chomasuRes?.data?.rows || [],
    };

    const strictRows = yearlyRes?.data?.rows || [];
    const rows = augmentYearlyRowsWithPartialFromSeasons(strictRows, seasonsByKey);
    setYearlyRows(rows);
    const overrides = {};
    const confirmed = {};
    for (const r of rows) {
      overrides[r.employeeName] = !!r.behaviourBonusApplied;
      confirmed[r.employeeName] = !!r.behaviourBonusApplied;
    }
    setBehaviourOverrides(overrides);
    setBehaviourConfirmed(confirmed);

    const edits = {};
    for (const r of rows) {
      edits[r.employeeName] = r.baseSalary;
    }
    setBaseSalaryEdits(edits);
  }

  const yearlyRowsView = useMemo(() => {
    return yearlyRows.map((r) => {
      const adjustedFinalIncrement = r.finalIncrementPercent ?? 0;
      const adjustedCompositeScore = inc18ToCompositeScore(adjustedFinalIncrement);
      return {
        ...r,
        adjustedFinalIncrement,
        adjustedCompositeScore,
        adjustedIncrementAmount: r.incrementAmount,
        adjustedTotalSalary: r.totalSalary,
      };
    });
  }, [yearlyRows]);

  function computeDashboardStats(rows) {
    if (!rows || rows.length === 0) {
      setDashboardStats({
        totalEmployees: 0,
        avgFinalIncrement: 0,
        totalSalaryBudget: 0,
        avgCompositeScore: 0,
        dataCompleteness: 0
      });
      return;
    }

    const totalEmployees = rows.length;
    
    const validIncrements = rows.filter(r => r.finalIncrementPercent != null).map((r) => r.adjustedFinalIncrement);
    const avgFinalIncrement = validIncrements.length > 0 
      ? validIncrements.reduce((a, b) => a + b, 0) / validIncrements.length 
      : 0;
    
    const totalSalaryBudget = rows.reduce((sum, r) => sum + (r.adjustedTotalSalary || r.totalSalary || 0), 0);
    
    const validScores = rows.filter(r => r.adjustedCompositeScore != null).map(r => r.adjustedCompositeScore);
    const avgCompositeScore = validScores.length > 0
      ? validScores.reduce((a, b) => a + b, 0) / validScores.length
      : 0;
    
    const depsTotals = rows.reduce((sum, r) => sum + (Number.isFinite(r.dependenciesTotal) ? r.dependenciesTotal : 5), 0);
    const depsFilled = rows.reduce((sum, r) => {
      if (Number.isFinite(r.dependenciesFilled)) return sum + r.dependenciesFilled;
      // Fallback: if final increment present assume complete; else assume zero
      return sum + (r.finalIncrementPercent != null ? 5 : 0);
    }, 0);

    const dataCompleteness = depsTotals > 0 ? (depsFilled / depsTotals) * 100 : 0;

    setDashboardStats({
      totalEmployees,
      avgFinalIncrement: avgFinalIncrement.toFixed(2),
      totalSalaryBudget: totalSalaryBudget.toFixed(2),
      avgCompositeScore: avgCompositeScore.toFixed(2),
      dataCompleteness: dataCompleteness.toFixed(0)
    });
  }

  useEffect(() => {
    computeDashboardStats(yearlyRowsView);
  }, [yearlyRowsView]);

  async function loadMonthly(month) {
    const res = await api.get(`/api/increments/${year}/monthly/${month}`);
    setMonthlyRows(res.data.rows || []);
  }

  async function loadYears() {
    const res = await api.get('/api/increments/years');
    const years = Array.isArray(res.data.years) ? res.data.years : [];
    setAvailableYears(years);
  }

  async function handleAddYear() {
    const yearNum = Number(newYear);
    if (!yearNum || yearNum < 2000 || yearNum > 2100) {
      setError('Please enter a valid year (2000-2100)');
      return;
    }
    
    if (availableYears.includes(yearNum)) {
      setError('Year already exists');
      return;
    }

    try {
      const res = await api.post('/api/increments/years', { year: yearNum });
      
      if (res.data.success) {
        setNewYear('');
        setShowAddYearModal(false);
        setAvailableYears([...availableYears, yearNum].sort((a, b) => b - a));
        setYear(yearNum);
        setMessage(`Year ${yearNum} added successfully`);
      } else {
        setError(res.data.message || 'Failed to add year');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add year');
    }
  }

  useEffect(() => {
    loadYears().catch(() => setAvailableYears([]));
    loadUploadedFiles().catch(() => {});
  }, []);

  async function loadUploadedFiles() {
    try {
      const res = await api.get(`/api/increments/${year}/uploaded-files`);
      if (res.data.success) {
        const filesMap = {};
        for (const file of res.data.files) {
          const key = `${file.season}_${file.metric}`;
          filesMap[key] = file;
        }
        setUploadedFiles(filesMap);
      }
    } catch (err) {
      console.error('Failed to load uploaded files', err);
    }
  }

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (showExportDropdown && !e.target.closest('.export-dropdown-container')) {
        setShowExportDropdown(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showExportDropdown]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
    localStorage.setItem('darkMode', darkMode);
  }, [darkMode]);

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

  // Pagination helpers
  const getPaginatedData = (data) => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return data.slice(startIndex, endIndex);
  };

  const getTotalPages = (data) => {
    return Math.ceil(data.length / itemsPerPage);
  };

  const renderPagination = (data) => {
    const totalPages = getTotalPages(data);
    if (totalPages <= 1) return null;

    const startItem = (currentPage - 1) * itemsPerPage + 1;
    const endItem = Math.min(currentPage * itemsPerPage, data.length);

    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        marginTop: '1.5rem',
        padding: '1rem',
        background: 'var(--bg)',
        borderRadius: '8px',
        border: '1px solid var(--border)',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div style={{ fontSize: '0.875rem', color: 'var(--text-light)', fontWeight: '500' }}>
          Showing {startItem} to {endItem} of {data.length} employees
        </div>
        <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => {
            // Show first page, last page, current page, and pages around current
            const showPage = page === 1 || 
                             page === totalPages || 
                             (page >= currentPage - 1 && page <= currentPage + 1);
            
            const showEllipsis = (page === 2 && currentPage > 3) || 
                                 (page === totalPages - 1 && currentPage < totalPages - 2);

            if (!showPage && !showEllipsis) return null;

            if (showEllipsis) {
              return <span key={page} style={{ padding: '0 0.5rem', color: 'var(--text-light)', fontSize: '0.875rem' }}>...</span>;
            }

            return (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={page === currentPage ? 'btn btn-primary' : 'btn btn-secondary'}
                style={{ 
                  padding: '0.5rem 0.75rem',
                  fontSize: '0.875rem',
                  minWidth: '40px',
                  fontWeight: page === currentPage ? '700' : '500'
                }}
              >
                {page}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  useEffect(() => {
    setMessage(null);
    setError(null);
    setCurrentPage(1); // Reset to first page
    if (tab === 'dashboard') {
      loadYearly().catch(() => setYearlyRows([]));
    } else if (tab === 'yearly') {
      loadYearly().catch(() => setYearlyRows([]));
    } else if (tab === 'monthly') {
      loadMonthly(abMonth).catch(() => setMonthlyRows([]));
    } else {
      loadSeason(tab).catch(() => setSeasonRows([]));
    }
    loadUploadedFiles().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, tab, abMonth]);

  async function uploadSeasonMetricInternal(season, metric, file, opts = {}) {
    const { attemptedAuto = false, yearOverride = null } = opts;
    const yr = yearOverride ?? year;

    const form = new FormData();
    form.append('file', file);

    try {
      // First, try to upload as template (this validates the structure)
      try {
        const templateRes = await api.post(`/api/templates/${yr}/${season}/${metric}/upload`, form, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        if (templateRes?.data?.employeeCount) {
          setMessage(`Template validated with ${templateRes.data.employeeCount} employee(s). Processing data...`);
        }
      } catch (templateErr) {
        // If template validation fails, show error and stop
        throw new Error(templateErr?.response?.data?.error || 'Template validation failed');
      }

      // If template validation succeeds, upload the data
      const res = await api.post(`/api/increments/${yr}/seasons/${season}/metrics/${metric}/upload`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const baseMsg = `${SEASONS.find((s) => s.key === season)?.label} ${METRICS.find((m) => m.key === metric)?.label} uploaded successfully`;
      const detectedYearMsg = res?.data?.detectedYear ? ` • Detected year: ${res.data.detectedYear}` : '';
      const extraMsg = res?.data?.message ? ` • ${res.data.message}` : '';
      setMessage(`${baseMsg}${detectedYearMsg}${extraMsg}`);

      await loadSeason(season);
      await loadYearly().catch(() => setYearlyRows([]));
      await loadYears().catch(() => {});
      await loadUploadedFiles().catch(() => {});
    } catch (err) {
      const excelYear = err?.response?.data?.excelYear ?? err?.response?.data?.detectedYear;
      const selectedYear = err?.response?.data?.selectedYear ?? yr;

      if (!attemptedAuto && excelYear && Number(excelYear) !== Number(selectedYear)) {
        setMessage(`Year mismatch: selected ${selectedYear}, Excel ${excelYear}. Switching to ${excelYear} and uploading...`);
        setError(null);
        setYear(Number(excelYear));
        await uploadSeasonMetricInternal(season, metric, file, { attemptedAuto: true, yearOverride: Number(excelYear) });
        return;
      }

      throw err;
    }
  }

  async function uploadSeasonMetric(season, metric, file) {
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      await uploadSeasonMetricInternal(season, metric, file);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Upload failed');
    } finally {
      setBusy(false);
    }
  }

  async function uploadCombined(season, file) {
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await api.post(
        `/api/increments/${year}/seasons/${season}/upload-combined`,
        form,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      const d = res.data;
      const empSummary = (d.employees || []).map((e) =>
        `${e.employee}: NRV ${e.avgNrvInc?.toFixed(2)}, SG ${e.avgSalesGrowthInc?.toFixed(2)}, SR ${e.avgSrInc?.toFixed(2)}`
      ).join(' | ');
      const skippedDetails = (d.sheetErrors || []).map(e => `${e.sheet}: ${e.error}`).join('\n');
      const errMsg = d.sheetErrors?.length
        ? ` — ${d.sheetErrors.length} sheet${d.sheetErrors.length > 1 ? 's' : ''} skipped`
        : '';
      setMessage(
        `Combined upload done — ${d.employeesProcessed} employee${d.employeesProcessed !== 1 ? 's' : ''} processed${errMsg}. ${empSummary}`
      );

      // Collect all "min price not set" warnings across all employees
      const missingMinPriceLines = (d.employees || []).flatMap((e) => {
        const missing = e.noMinPriceProducts ?? [];
        if (missing.length === 0) return [];
        return [`${e.employee}: Min price not written for — ${missing.join(', ')}`];
      });

      const warnings = [
        ...(skippedDetails ? [`Skipped sheets:\n${skippedDetails}`] : []),
        ...missingMinPriceLines,
      ];
      if (warnings.length) {
        setError(warnings.join('\n'));
      }
      await loadSeason(season);
      await loadYearly().catch(() => setYearlyRows([]));
      await loadUploadedFiles().catch(() => {});
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Combined upload failed');
    } finally {
      setBusy(false);
    }
  }

  const [newEmployee, setNewEmployee] = useState({ name: '', surname: '', phone: '' });

  async function createEmployeeFromDashboard() {
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const payload = {
        name: (newEmployee.name || '').trim(),
        surname: (newEmployee.surname || '').trim(),
        phone: (newEmployee.phone || '').trim(),
      };
      if (!payload.name) throw new Error('Name is required');

      const res = await api.post('/api/employees', payload);
      const displayName = [payload.name, payload.surname].filter(Boolean).join(' ').trim();
      const tpl = res?.data?.templates;
      const tplMsg = tpl
        ? ` • Templates: updated ${tpl.updated}/${tpl.scanned} (skipped existing ${tpl.skippedExists}, skipped no SAVAN SEEDS ${tpl.skippedNoSavan}, failed ${tpl.failed})`
        : '';
      setMessage(`Employee added: ${displayName}${tplMsg}`);
      setNewEmployee({ name: '', surname: '', phone: '' });
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Failed to add employee');
    } finally {
      setBusy(false);
    }
  }

  async function downloadSeasonFile(season, metric) {
    try {
      const url = metric === 'combined'
        ? `/api/increments/${year}/seasons/${season}/download-combined`
        : `/api/increments/${year}/seasons/${season}/metrics/${metric}/download`;

      const res = await api.get(url, { responseType: 'blob' });
      
      const blob = new Blob([res.data]);
      const objectUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = `${year}_${season}_${metric}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(objectUrl);
      
      const label = metric === 'combined' ? 'Combined file' : (METRICS.find(m => m.key === metric)?.label ?? metric);
      setMessage(`${label} downloaded successfully`);
    } catch (err) {
      setError(err?.response?.data?.message || 'Download failed');
    }
  }

  async function downloadTemplate(season, metric) {
    try {
      const res = await api.get(`/api/templates/${year}/${season}/${metric}/download`, {
        responseType: 'blob'
      });
      
      const blob = new Blob([res.data]);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${season}_${metric}_template.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      setMessage(`Template downloaded successfully`);
    } catch (err) {
      setError(err?.response?.data?.message || 'Template not available. Please upload a valid template first.');
    }
  }

  async function uploadYearlyInternal(kind, file, opts = {}) {
    const { attemptedAuto = false, yearOverride = null } = opts;
    const yr = yearOverride ?? year;

    if (kind === 'behaviour') {
      throw new Error('Behaviour metric has been removed');
    }

    const form = new FormData();
    form.append('file', file);
    const url = kind === 'activity'
      ? `/api/increments/${yr}/${kind}/${abMonth}/upload`
      : `/api/increments/${yr}/${kind}/upload`;

    try {
      const res = await api.post(url, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const baseMsg = `${kind.charAt(0).toUpperCase() + kind.slice(1)} uploaded successfully`;
      const detectedYearMsg = res?.data?.detectedYear ? ` • Detected year: ${res.data.detectedYear}` : '';
      const extraMsg = res?.data?.message ? ` • ${res.data.message}` : '';
      setMessage(`${baseMsg}${detectedYearMsg}${extraMsg}`);

      if (kind === 'activity') {
        await loadMonthly(abMonth);
      }
      await loadYearly();
      await loadYears().catch(() => {});
    } catch (err) {
      const excelYear = err?.response?.data?.excelYear ?? err?.response?.data?.detectedYear;
      const selectedYear = err?.response?.data?.selectedYear ?? yr;

      if (!attemptedAuto && excelYear && Number(excelYear) !== Number(selectedYear)) {
        setMessage(`Year mismatch: selected ${selectedYear}, Excel ${excelYear}. Switching to ${excelYear} and uploading...`);
        setError(null);
        setYear(Number(excelYear));
        await uploadYearlyInternal(kind, file, { attemptedAuto: true, yearOverride: Number(excelYear) });
        return;
      }

      throw err;
    }
  }

  async function uploadYearly(kind, file) {
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      await uploadYearlyInternal(kind, file);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Upload failed');
    } finally {
      setBusy(false);
    }
  }

  async function saveBaseSalaries() {
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const payload = yearlyRows
        .filter((r) => r.baseSalarySource === 'manual')
        .map((r) => ({ employeeName: r.employeeName, baseSalary: Number(baseSalaryEdits[r.employeeName] || 0) }));

      await api.post(`/api/increments/${year}/base-salaries`, payload);
      setMessage('Base salaries saved successfully');
      await loadYearly();
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  function buildExportConfig() {
    const datePart = todayDatePart();

    if (SEASONS.some((s) => s.key === tab)) {
      const seasonLabel = SEASONS.find((s) => s.key === tab)?.label || tab;
      return {
        filenameBase: `season_${seasonLabel}_${year}_${datePart}`,
        sheetName: seasonLabel,
        title: `Season Results - ${seasonLabel}`,
        subtitle: `Year: ${year}`,
        columns: [
          { header: 'Employee Name', key: 'employeeName' },
          { header: 'Sales Return Inc', value: (r) => fmt(r.salesReturnInc) },
          { header: 'Sales Growth Inc', value: (r) => fmt(r.salesGrowthInc) },
          { header: 'NRV Inc', value: (r) => fmt(r.nrvInc) },
          { header: 'Payment Collection Inc', value: (r) => fmt(r.paymentCollectionInc) },
          { header: 'Season Increment', value: (r) => fmt(r.seasonInc) },
        ],
        rows: seasonRows,
      };
    }

    if (tab === 'monthly') {
      const monthLabel = MONTHS.find((m) => m.value === abMonth)?.label || String(abMonth);
      return {
        filenameBase: `monthly_${monthLabel}_${year}_${datePart}`,
        sheetName: `Monthly-${monthLabel}`,
        title: 'Monthly Results',
        subtitle: `Year: ${year} • Month: ${monthLabel}`,
        columns: [
          { header: 'Employee', key: 'employeeName' },
          { header: 'Activity %', value: (r) => fmt(r.activityPct) },
        ],
        rows: monthlyRows,
      };
    }

    // yearly
    return {
      filenameBase: `yearly_${year}_${datePart}`,
      sheetName: `Yearly-${year}`,
      title: 'Yearly Summary',
      subtitle: `Year: ${year}`,
      columns: [
        { header: 'Employee', key: 'employeeName' },
        { header: 'Sales Return', value: (r) => fmt(r.yearSalesReturnInc) },
        { header: 'Sales Growth', value: (r) => fmt(r.yearSalesGrowthInc) },
        { header: 'NRV', value: (r) => fmt(r.yearNrvInc) },
        { header: 'Payment', value: (r) => fmt(r.yearPaymentCollectionInc) },
        { header: 'Activity', value: (r) => fmt(r.activityInc) },
        { header: 'Final Inc % (Adj)', value: (r) => fmt(r.adjustedFinalIncrement) },
        { header: 'Base Salary', value: (r) => fmtCurrency(r.baseSalary) },
        { header: 'Increment ₹', value: (r) => fmtCurrency(r.adjustedIncrementAmount) },
        { header: 'Total Salary', value: (r) => fmtCurrency(r.adjustedTotalSalary) },
      ],
      rows: yearlyRowsView,
    };
  }

  function handleDownloadExcel() {
    const cfg = buildExportConfig();
    downloadExcel(cfg);
  }

  function handleDownloadPdf() {
    const cfg = buildExportConfig();
    downloadPdf(cfg);
  }

  function seasonColumns() {
    return [
      { header: 'Employee Name', key: 'employeeName' },
      { header: 'Sales Return Inc', value: (r) => fmt(r.salesReturnInc) },
      { header: 'Sales Growth Inc', value: (r) => fmt(r.salesGrowthInc) },
      { header: 'NRV Inc', value: (r) => fmt(r.nrvInc) },
      { header: 'Payment Collection Inc', value: (r) => fmt(r.paymentCollectionInc) },
      { header: 'Season Increment', value: (r) => fmt(r.seasonInc) },
    ];
  }

  function seasonComparisonColumns() {
    return [
      { header: 'Employee', key: 'employeeName' },
      { header: 'Shiyadu (Season Inc)', value: (r) => fmt(r.shiyaduSeasonInc) },
      { header: 'Unadu (Season Inc)', value: (r) => fmt(r.unaduSeasonInc) },
      { header: 'Chomasu (Season Inc)', value: (r) => fmt(r.chomasuSeasonInc) },
    ];
  }

  function buildSeasonComparisonRows(seasonsByKey) {
    const map = new Map();

    for (const seasonKey of ['shiyadu', 'unadu', 'chomasu']) {
      const rows = seasonsByKey?.[seasonKey] || [];
      for (const r of rows) {
        const name = r?.employeeName;
        if (!name) continue;
        const prev = map.get(name) || { employeeName: name };
        prev[`${seasonKey}SeasonInc`] = r?.seasonInc ?? null;
        map.set(name, prev);
      }
    }

    return Array.from(map.values()).sort((a, b) => String(a.employeeName).localeCompare(String(b.employeeName)));
  }

  function monthlyAllColumns() {
    // kept for tab-level export config; full-year export uses pivot tables instead
    return [
      { header: 'Month', key: 'month' },
      { header: 'Employee', key: 'employeeName' },
      { header: 'Activity %', value: (r) => fmt(r.activityPct) },
    ];
  }

  function monthlyActivityPivotColumns() {
    return [
      { header: 'Employee', key: 'employeeName' },
      ...MONTHS.map((m) => ({
        header: m.short,
        value: (r) => fmt(r.activityByMonth?.[m.value]),
      })),
    ];
  }

  function applyBehaviourAdjust(rows) {
    return rows.map((r) => {
      const adjustedFinalIncrement = r.finalIncrementPercent ?? 0;
      const adjustedCompositeScore = inc18ToCompositeScore(adjustedFinalIncrement);
      return {
        ...r,
        adjustedFinalIncrement,
        adjustedCompositeScore,
        adjustedIncrementAmount: r.incrementAmount,
        adjustedTotalSalary: r.totalSalary,
      };
    });
  }

  function yearlyColumns() {
    return [
      { header: 'Employee', key: 'employeeName' },
      { header: 'Sales Return Inc', value: (r) => fmt(r.yearSalesReturnInc) },
      { header: 'Sales Growth Inc', value: (r) => fmt(r.yearSalesGrowthInc) },
      { header: 'NRV Inc', value: (r) => fmt(r.yearNrvInc) },
      { header: 'Payment Inc', value: (r) => fmt(r.yearPaymentCollectionInc) },
      { header: 'Activity Inc', value: (r) => fmt(r.activityInc) },
      { header: 'Behaviour Bonus', value: (r) => r.behaviourBonusApplied ? '1%' : '0%' },
      { header: 'Final Inc % (Adj)', value: (r) => fmt(r.adjustedFinalIncrement ?? r.finalIncrementPercent) },
      { header: 'Composite Score', value: (r) => fmtScore(r.adjustedCompositeScore ?? r.compositeScore) },
      { header: 'Base Salary', value: (r) => fmtCurrencyForExport(r.baseSalary) },
      { header: 'Increment', value: (r) => fmtCurrencyForExport(r.adjustedIncrementAmount ?? r.incrementAmount) },
      { header: 'Total Salary', value: (r) => fmtCurrencyForExport(r.adjustedTotalSalary ?? r.totalSalary) },
    ];
  }

  async function fetchFullYearData() {
    const seasonReqs = SEASONS.map((s) => api.get(`/api/increments/${year}/seasons/${s.key}`));
    const monthlyReqs = MONTHS.map((m) => api.get(`/api/increments/${year}/monthly/${m.value}`));
    const yearlyReq = api.get(`/api/increments/${year}/yearly`);

    const [seasonRes, monthlyRes, yearlyRes] = await Promise.all([
      Promise.all(seasonReqs),
      Promise.all(monthlyReqs),
      yearlyReq,
    ]);

    const seasonsByKey = {};
    for (let i = 0; i < SEASONS.length; i += 1) {
      const key = SEASONS[i].key;
      seasonsByKey[key] = seasonRes[i]?.data?.rows || [];
    }

    const yearlyRows = yearlyRes?.data?.rows || [];

    // Build a nicer monthly export: one row per employee, columns Jan..Dec.
    const nameSet = new Set();
    for (const r of yearlyRows) {
      if (r?.employeeName) nameSet.add(r.employeeName);
    }
    if (nameSet.size === 0) {
      for (const res of monthlyRes) {
        for (const r of (res?.data?.rows || [])) {
          if (r?.employeeName) nameSet.add(r.employeeName);
        }
      }
    }
    const employeeNames = Array.from(nameSet).sort((a, b) => String(a).localeCompare(String(b)));

    const monthToMap = new Map();
    for (let i = 0; i < MONTHS.length; i += 1) {
      const monthNum = MONTHS[i].value;
      const rows = monthlyRes[i]?.data?.rows || [];
      const m = new Map();
      for (const r of rows) {
        m.set(r.employeeName, { activityPct: r.activityPct });
      }
      monthToMap.set(monthNum, m);
    }

    const monthlyPivotRows = employeeNames.map((name) => {
      const activityByMonth = {};
      for (const m of MONTHS) {
        const mm = monthToMap.get(m.value);
        const v = mm?.get(name);
        activityByMonth[m.value] = typeof v?.activityPct === 'number' ? v.activityPct : 0;
      }
      return { employeeName: name, activityByMonth };
    });

      const yearlyRowsAug = augmentYearlyRowsWithPartialFromSeasons(yearlyRows, seasonsByKey);
      return { seasonsByKey, monthlyPivotRows, yearlyRows: yearlyRowsAug };
  }

  async function handleDownloadFullYearExcel() {
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const datePart = todayDatePart();
      const { seasonsByKey, monthlyPivotRows, yearlyRows } = await fetchFullYearData();
      const yearlyRowsAdjusted = applyBehaviourAdjust(yearlyRows);
      const seasonComparisonRows = buildSeasonComparisonRows(seasonsByKey);

      downloadExcelWorkbookMixed({
        filenameBase: `full_year_${year}_${datePart}`,
        sheets: [
          {
            sheetName: `Seasons-${year}`,
            blocks: [
              { title: 'Season Comparison (Season Increment)', columns: seasonComparisonColumns(), rows: seasonComparisonRows },
            ],
          },
          { sheetName: `Shiyadu-${year}`, columns: seasonColumns(), rows: seasonsByKey.shiyadu || [] },
          { sheetName: `Unadu-${year}`, columns: seasonColumns(), rows: seasonsByKey.unadu || [] },
          { sheetName: `Chomasu-${year}`, columns: seasonColumns(), rows: seasonsByKey.chomasu || [] },
          { sheetName: `Monthly Activity-${year}`, columns: monthlyActivityPivotColumns(), rows: monthlyPivotRows },
          { sheetName: `Yearly-${year}`, columns: yearlyColumns(), rows: yearlyRowsAdjusted },
        ],
      });

      setMessage('Full year Excel downloaded');
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Export failed');
    } finally {
      setBusy(false);
    }
  }

  async function handleDownloadFullYearPdf() {
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const datePart = todayDatePart();
      const { seasonsByKey, monthlyPivotRows, yearlyRows } = await fetchFullYearData();
      const yearlyRowsAdjusted = applyBehaviourAdjust(yearlyRows);
      const seasonComparisonRows = buildSeasonComparisonRows(seasonsByKey);

      downloadPdfSections({
        filenameBase: `full_year_${year}_${datePart}`,
        title: 'Full Year Export',
        subtitle: `Year: ${year}`,
        sections: [
          { title: 'Season Comparison (Season Increment)', columns: seasonComparisonColumns(), rows: seasonComparisonRows },
          { title: 'Monthly Activity (Jan–Dec)', columns: monthlyActivityPivotColumns(), rows: monthlyPivotRows },
          { title: 'Yearly Summary', columns: yearlyColumns(), rows: yearlyRowsAdjusted },
        ],
      });

      setMessage('Full year PDF downloaded');
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Export failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, var(--bg) 0%, var(--surface) 100%)' }}>
      {/* Header */}
      <header style={{
        background: 'var(--surface)',
        borderBottom: '2px solid var(--border)',
        padding: '0.75rem 2rem',
        height: '70px',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        boxShadow: 'var(--shadow-lg)',
        backdropFilter: 'blur(10px)'
      }}>
        <div style={{ maxWidth: '1500px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '100%', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ 
              fontSize: '1.75rem',
              background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%)',
              width: '45px',
              height: '45px',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: 'var(--shadow)'
            }}>
              🌾
            </div>
            <div>
              <h1 style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--text)', margin: 0 }}>
                Increment Dashboard
              </h1>
            </div>
          </div>
          
          <div className="header-actions" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', fontWeight: '500' }}>
              <span>📅</span>
              <select
                className="select input-sm"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                style={{ width: '100px', padding: '0.35rem 0.5rem', fontSize: '0.875rem' }}
                disabled={busy}
              >
                {Array.from(new Set([year, ...availableYears]))
                  .sort((a, b) => b - a)
                  .map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
              </select>
            </label>
            <button
              onClick={() => setShowAddYearModal(true)}
              disabled={busy}
              className="btn btn-secondary"
              style={{ padding: '0.35rem 0.65rem', fontSize: '0.875rem' }}
            >
              + Year
            </button>
            <div className="export-dropdown-container" style={{ position: 'relative' }}>
              <button
                onClick={() => setShowExportDropdown(!showExportDropdown)}
                className="btn btn-secondary"
                disabled={busy}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                <span>⬇️</span>
                <span>Export Full Year</span>
                <span style={{ fontSize: '0.7rem' }}>▼</span>
              </button>
              {showExportDropdown && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    marginTop: '0.25rem',
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                    zIndex: 100,
                    minWidth: '180px',
                  }}
                >
                  <button
                    onClick={() => {
                      handleDownloadFullYearExcel();
                      setShowExportDropdown(false);
                    }}
                    disabled={busy}
                    style={{
                      width: '100%',
                      padding: '0.75rem 1rem',
                      border: 'none',
                      background: 'transparent',
                      textAlign: 'left',
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      borderBottom: '1px solid var(--border)',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <span>📊</span>
                    <span>Excel</span>
                  </button>
                  <button
                    onClick={() => {
                      handleDownloadFullYearPdf();
                      setShowExportDropdown(false);
                    }}
                    disabled={busy}
                    style={{
                      width: '100%',
                      padding: '0.75rem 1rem',
                      border: 'none',
                      background: 'transparent',
                      textAlign: 'left',
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <span>📄</span>
                    <span>PDF</span>
                  </button>
                </div>
              )}
            </div>
            <button
              onClick={toggleDarkMode}
              className="btn btn-secondary"
              style={{ display: 'flex', alignItems: 'center', padding: '0.4rem 0.65rem' }}
              title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              <span style={{ fontSize: '1.1rem' }}>{darkMode ? '☀️' : '🌙'}</span>
            </button>
            <button onClick={handleLogout} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.7rem', fontSize: '0.875rem' }}>
              <span>🚪</span>
              <span>Logout</span>
            </button>
          </div>

          <div className="header-menu-toggle">
            <button
              className="btn btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.4rem 0.7rem' }}
              onClick={() => setShowHeaderMenu((v) => !v)}
              aria-label="Toggle menu"
            >
              <span>☰</span>
              <span style={{ fontSize: '0.85rem' }}>Menu</span>
            </button>
            {showHeaderMenu && (
              <div className="header-menu-dropdown">
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', fontWeight: '600' }}>
                  <span>📅</span>
                  <select
                    className="select input-sm"
                    value={year}
                    onChange={(e) => {
                      setYear(Number(e.target.value));
                      setShowHeaderMenu(false);
                    }}
                    disabled={busy}
                  >
                    {Array.from(new Set([year, ...availableYears]))
                      .sort((a, b) => b - a)
                      .map((y) => (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      ))}
                  </select>
                </label>
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    setShowAddYearModal(true);
                    setShowHeaderMenu(false);
                  }}
                  disabled={busy}
                  style={{ justifyContent: 'center' }}
                >
                  + Year
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    handleDownloadFullYearExcel();
                    setShowHeaderMenu(false);
                  }}
                  disabled={busy}
                  style={{ justifyContent: 'center' }}
                >
                  ⬇️ Export Excel
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    handleDownloadFullYearPdf();
                    setShowHeaderMenu(false);
                  }}
                  disabled={busy}
                  style={{ justifyContent: 'center' }}
                >
                  📄 Export PDF
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    toggleDarkMode();
                    setShowHeaderMenu(false);
                  }}
                  style={{ justifyContent: 'center' }}
                  title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                >
                  {darkMode ? '☀️ Light Mode' : '🌙 Dark Mode'}
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    handleLogout();
                    setShowHeaderMenu(false);
                  }}
                  style={{ justifyContent: 'center' }}
                >
                  🚪 Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div style={{
        display: 'flex',
        borderBottom: '2px solid var(--border)',
        background: 'var(--surface)',
        padding: '0.75rem 2rem',
        position: 'sticky',
        top: '70px',
        zIndex: 90,
        boxShadow: 'var(--shadow)'
      }}>
        <div style={{ maxWidth: '1500px', margin: '0 auto', display: 'flex', gap: '0.5rem', width: '100%', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => setTab('dashboard')}
            disabled={busy}
            className={`btn btn-tab ${tab === 'dashboard' ? 'active' : ''}`}
          >
            📊 Analytics Dashboard
          </button>
          {SEASONS.map((s) => (
            <button
              key={s.key}
              onClick={() => setTab(s.key)}
              disabled={busy}
              className={`btn btn-tab ${tab === s.key ? 'active' : ''}`}
            >
              {s.label}
            </button>
          ))}
          <button
            onClick={() => setTab('monthly')}
            disabled={busy}
            className={`btn btn-tab ${tab === 'monthly' ? 'active' : ''}`}
          >
            🗓️ Monthly
          </button>
          <button
            onClick={() => setTab('yearly')}
            disabled={busy}
            className={`btn btn-tab ${tab === 'yearly' ? 'active' : ''}`}
          >
            📈 Yearly Summary
          </button>
          <button
            onClick={() => setTab('employees')}
            disabled={busy}
            className={`btn btn-tab ${tab === 'employees' ? 'active' : ''}`}
          >
            ➕ Add Employee
          </button>
        </div>
      </div>

      <main style={{ maxWidth: '1500px', margin: '0 auto', padding: '1.5rem 2rem' }}>
        {/* Alerts */}
        {message && (
          <div className="alert alert-success">
            <span style={{ fontSize: '1.2rem' }}>✓</span>
            <span>{message}</span>
          </div>
        )}
        {error && (
          <div className="alert alert-danger">
            <span style={{ fontSize: '1.2rem' }}>✗</span>
            <span>{error}</span>
          </div>
        )}
        {busy && (
          <div className="alert alert-warning">
            <span className="spinner spinner-primary" />
            <span>Processing...</span>
          </div>
        )}

        {/* Analytics Dashboard View */}
        {tab === 'dashboard' && (
          <div>
            {/* Key Metrics Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
              <div className="card" style={{ padding: '1.5rem', background: 'linear-gradient(135deg, #3b82f6 5%, var(--surface) 5%)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{
                    background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                    width: '60px',
                    height: '60px',
                    borderRadius: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '2rem',
                    boxShadow: '0 8px 16px rgba(59, 130, 246, 0.3)'
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

              <div className="card" style={{ padding: '1.5rem', background: 'linear-gradient(135deg, #10b981 5%, var(--surface) 5%)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    width: '60px',
                    height: '60px',
                    borderRadius: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '2rem',
                    boxShadow: '0 8px 16px rgba(16, 185, 129, 0.3)'
                  }}>
                    📈
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-light)', margin: 0, fontWeight: '500' }}>Avg Increment</p>
                    <h3 style={{ fontSize: '2.5rem', fontWeight: '700', margin: 0, color: 'var(--success)' }}>{dashboardStats.avgFinalIncrement}%</h3>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-light)', margin: 0, marginTop: '0.25rem' }}>Max possible: 18%</p>
                  </div>
                </div>
              </div>

              <div className="card" style={{ padding: '1.5rem', background: 'linear-gradient(135deg, #f59e0b 5%, var(--surface) 5%)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{
                    background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                    width: '60px',
                    height: '60px',
                    borderRadius: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '2rem',
                    boxShadow: '0 8px 16px rgba(245, 158, 11, 0.3)'
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
              {/* Sales Performance Metrics */}
              <div className="card" style={{ height: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                  <div style={{
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    width: '40px',
                    height: '40px',
                    borderRadius: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.25rem'
                  }}>
                    🎯
                  </div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: '600', margin: 0, color: 'var(--text)' }}>
                    Sales Performance yearly
                  </h3>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  {[
                    { label: 'Sales Return Inc', key: 'yearSalesReturnInc', color: '#3b82f6', icon: '↩️' },
                    { label: 'Sales Growth Inc', key: 'yearSalesGrowthInc', color: '#10b981', icon: '📈' },
                    { label: 'NRV Inc', key: 'yearNrvInc', color: '#f59e0b', icon: '💰' },
                    { label: 'Payment Inc', key: 'yearPaymentCollectionInc', color: '#8b5cf6', icon: '💳' }
                  ].map(metric => {
                    const validValues = yearlyRows.filter(r => r[metric.key] != null).map(r => r[metric.key]);
                    const avg = validValues.length > 0 ? validValues.reduce((a, b) => a + b, 0) / validValues.length : 0;
                    const percentage = (avg / 18) * 100;
                    return (
                      <div key={metric.key}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                          <span style={{ fontSize: '0.95rem', fontWeight: '600', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span>{metric.icon}</span>
                            {metric.label}
                          </span>
                          <span style={{ fontSize: '0.95rem', fontWeight: '700', color: metric.color }}>{avg.toFixed(2)}%</span>
                        </div>
                        <div style={{ width: '100%', height: '12px', background: 'var(--border)', borderRadius: '999px', overflow: 'hidden', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1)' }}>
                          <div style={{ 
                            width: `${percentage}%`, 
                            height: '100%', 
                            background: `linear-gradient(90deg, ${metric.color}, ${metric.color}dd)`, 
                            transition: 'width 0.5s ease',
                            boxShadow: `0 0 8px ${metric.color}66`
                          }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Additional Analytics Modules */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem' }}>
              {/* Top Performers List */}
              <div className="card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                  <div style={{
                    background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                    width: '40px',
                    height: '40px',
                    borderRadius: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.25rem'
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
                        background: idx === 0 ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, rgba(245, 158, 11, 0.05) 100%)' : 'var(--bg)',
                        borderRadius: '8px',
                        border: `2px solid ${idx === 0 ? 'rgba(245, 158, 11, 0.3)' : 'var(--border)'}`,
                        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateX(4px)';
                        e.currentTarget.style.boxShadow = 'var(--shadow)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateX(0)';
                        e.currentTarget.style.boxShadow = 'none';
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
                          background: idx === 0 ? 'linear-gradient(135deg, #f59e0b, #d97706)' : 'linear-gradient(135deg, #10b981, #059669)',
                          color: 'white',
                          padding: '0.375rem 0.75rem',
                          borderRadius: '6px',
                          fontWeight: '700',
                          fontSize: '0.875rem',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
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
                    background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                    width: '40px',
                    height: '40px',
                    borderRadius: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.25rem'
                  }}>
                    📊
                  </div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: '600', margin: 0, color: 'var(--text)' }}>
                    Increment Distribution
                  </h3>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  {(() => {
                    const ranges = [
                      { label: '0-5%', min: 0, max: 5, color: '#ef4444', icon: '🔴' },
                      { label: '5-10%', min: 5, max: 10, color: '#f59e0b', icon: '🟡' },
                      { label: '10-15%', min: 10, max: 15, color: '#10b981', icon: '🟢' },
                      { label: '15-18%', min: 15, max: 18.01, color: '#3b82f6', icon: '🔵' }
                    ];
                    return ranges.map(range => {
                      const count = yearlyRowsView.filter(r => {
                        const inc = r.adjustedFinalIncrement ?? 0;
                        return inc >= range.min && inc < range.max;
                      }).length;
                      const percentage = yearlyRowsView.length > 0 ? (count / yearlyRowsView.length) * 100 : 0;
                      return (
                        <div key={range.label}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                            <span style={{ fontSize: '0.95rem', fontWeight: '600', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span>{range.icon}</span>
                              {range.label}
                            </span>
                            <span style={{ fontSize: '0.95rem', fontWeight: '700', color: range.color }}>
                              {count} ({percentage.toFixed(1)}%)
                            </span>
                          </div>
                          <div style={{ width: '100%', height: '12px', background: 'var(--border)', borderRadius: '999px', overflow: 'hidden', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1)' }}>
                            <div style={{ 
                              width: `${percentage}%`, 
                              height: '100%', 
                              background: `linear-gradient(90deg, ${range.color}, ${range.color}dd)`, 
                              transition: 'width 0.5s ease',
                              boxShadow: `0 0 8px ${range.color}66`
                            }} />
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === 'employees' && (
          <div>
            <div className="card" style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                <div>
                  <h2 style={{ fontSize: '1.35rem', fontWeight: '700', margin: 0, color: 'var(--text)' }}>Add Employee</h2>
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-light)', margin: '0.25rem 0 0 0' }}>
                    Adds employee details and updates all Excel templates (inserts columns before SAVAN SEEDS).
                  </p>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.35rem' }}>Name *</label>
                  <input
                    className="input"
                    value={newEmployee.name}
                    onChange={(e) => setNewEmployee((p) => ({ ...p, name: e.target.value }))}
                    placeholder="e.g. Narsinhbhai"
                    disabled={busy}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.35rem' }}>Surname</label>
                  <input
                    className="input"
                    value={newEmployee.surname}
                    onChange={(e) => setNewEmployee((p) => ({ ...p, surname: e.target.value }))}
                    placeholder="e.g. Patel"
                    disabled={busy}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.35rem' }}>Phone</label>
                  <input
                    className="input"
                    value={newEmployee.phone}
                    onChange={(e) => setNewEmployee((p) => ({ ...p, phone: e.target.value }))}
                    placeholder="e.g. 9999999999"
                    disabled={busy}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <button className="btn btn-primary" onClick={createEmployeeFromDashboard} disabled={busy}>
                  Add Employee
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Season View */}
        {SEASONS.some((s) => s.key === tab) && (
          <div>
            <div className="card" style={{ marginBottom: '2rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                <div style={{
                  background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                  width: '48px',
                  height: '48px',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.5rem',
                  boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
                  flexShrink: 0
                }}>
                  📤
                </div>
                <div style={{ flex: 1, minWidth: '200px' }}>
                  <h2 style={{ fontSize: '1.35rem', fontWeight: '700', margin: 0, color: 'var(--text)' }}>
                    Upload Season Data
                  </h2>
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-light)', margin: '0.25rem 0 0 0' }}>
                    {SEASONS.find((s) => s.key === tab)?.label} Season • Upload Excel files
                  </p>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
                {/* Combined upload card: Sales Return + Sales Growth + NRV */}
                <div className="upload-card" style={{ position: 'relative', paddingTop: '1rem', gridColumn: '1 / -1' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                    <span style={{ fontSize: '1.1rem' }}>📊</span>
                    <label style={{ margin: 0, fontWeight: '700', fontSize: '1rem' }}>
                      Combined Upload &nbsp;<span style={{ fontWeight: '400', fontSize: '0.85rem', color: 'var(--text-light)' }}>(Sales Return + Sales Growth + NRV — all employees in one file)</span>
                    </label>
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <label
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        padding: '0.5rem 1rem',
                        background: busy ? 'var(--border)' : 'var(--primary)',
                        color: '#fff',
                        borderRadius: '8px',
                        cursor: busy ? 'not-allowed' : 'pointer',
                        fontSize: '0.9rem',
                        fontWeight: '600',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <span>📁</span>
                      <span>Choose Combined Excel (.xlsx)</span>
                      <input
                        type="file"
                        accept=".xlsx"
                        disabled={busy}
                        style={{ display: 'none' }}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) uploadCombined(tab, f);
                          e.currentTarget.value = '';
                        }}
                      />
                    </label>
                    {uploadedFiles[`${tab}_combined`] && (
                      <button
                        onClick={() => downloadSeasonFile(tab, 'combined')}
                        className="btn btn-secondary"
                        disabled={busy}
                        title="Download the previously uploaded combined file"
                        style={{ padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}
                      >
                        ⬇️ Download
                      </button>
                    )}
                  </div>
                  <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-light)' }}>
                    Each sheet = one employee. Sheet name must match the employee name exactly (e.g. sheet named "Jagdish").
                  </p>
                </div>

                {/* Payment Collection remains a separate upload */}
                {METRICS.map((m) => {
                  const fileKey = `${tab}_${m.key}`;
                  const hasFile = uploadedFiles[fileKey];
                  return (
                    <div className="upload-card" key={m.key} style={{ position: 'relative', paddingTop: '2.5rem' }}>
                      <button
                        onClick={() => downloadTemplate(tab, m.key)}
                        className="btn btn-secondary"
                        style={{ position: 'absolute', top: '0.5rem', left: '0.5rem', padding: '0.35rem 0.6rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                        disabled={busy}
                        title="Download template with formulas"
                      >
                        <span>⬇️</span>
                        <span>Template</span>
                      </button>
                      {hasFile && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            downloadSeasonFile(tab, m.key);
                          }}
                          className="btn btn-secondary"
                          style={{
                            position: 'absolute',
                            top: '0.5rem',
                            right: '0.5rem',
                            padding: '0.35rem 0.6rem',
                            fontSize: '0.75rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.35rem'
                          }}
                          disabled={busy}
                          title="Download uploaded file"
                        >
                          <span>⬇️</span>
                          <span>Download</span>
                        </button>
                      )}
                      <label>{m.label}</label>
                      <input
                        type="file"
                        accept=".xlsx"
                        disabled={busy}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) uploadSeasonMetric(tab, m.key, f);
                          e.currentTarget.value = '';
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1, minWidth: '200px' }}>
                  <div style={{
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    width: '48px',
                    height: '48px',
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.5rem',
                    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
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
                      <th>Employee Name</th>
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
                        <td style={{ fontWeight: '500' }}>{r.employeeName}</td>
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
                            Upload Excel files above to see season increment results
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {renderPagination(seasonRows)}
            </div>
          </div>
        )}

        {/* Monthly View */}
        {tab === 'monthly' && (
          <div>
            <div className="card" style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                <div style={{
                  background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                  width: '48px',
                  height: '48px',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.5rem',
                  boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)'
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

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
                <div className="upload-card">
                  <label>Activity %</label>
                  <input
                    type="file"
                    accept=".xlsx"
                    disabled={busy}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) uploadYearly('activity', f);
                      e.currentTarget.value = '';
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1, minWidth: '200px' }}>
                  <div style={{
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    width: '48px',
                    height: '48px',
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.5rem',
                    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
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
                      <th>Employee</th>
                      <th className="table-number">Activity %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getPaginatedData(monthlyRows).map((r) => (
                      <tr key={r.employeeName}>
                        <td style={{ fontWeight: '500' }}>{r.employeeName}</td>
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
        )}

        {/* Yearly View */}
        {tab === 'yearly' && (
          <div>
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{
                    background: 'linear-gradient(135deg, var(--primary-light) 0%, var(--primary) 100%)',
                    width: '40px',
                    height: '40px',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.5rem'
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
                      <th>Employee</th>
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
                        <td style={{ fontWeight: '500' }}>{r.employeeName}</td>
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
        )}
      </main>

      {/* Add Year Modal */}
      {showAddYearModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setShowAddYearModal(false)}
        >
          <div
            className="card"
            style={{ width: '400px', maxWidth: '90%' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 1rem 0' }}>Add New Year</h3>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: '500' }}>
                Year
              </label>
              <input
                type="number"
                className="input"
                placeholder="e.g., 2027"
                value={newYear}
                onChange={(e) => setNewYear(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddYear();
                  if (e.key === 'Escape') setShowAddYearModal(false);
                }}
                autoFocus
                min="2000"
                max="2100"
              />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowAddYearModal(false);
                  setNewYear('');
                }}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button onClick={handleAddYear} className="btn btn-primary">
                Add Year
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
