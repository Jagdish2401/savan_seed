import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { 
  Download, Plus, FileSpreadsheet, FileText, LayoutDashboard, BarChart2, 
  Calendar as CalIcon, TrendingUp, Users, UserPlus, User, ShieldCheck, 
  Phone, Mail, Lock, UserCheck, Edit, Trash2, Settings
} from 'lucide-react';
import { api } from '../lib/api';
import {
  downloadExcel,
  downloadExcelWorkbookMixed,
  downloadPdf,
  downloadPdfSections,
} from '../utils/export';

import { MONTHS, METRICS, SEASONS } from './dashboard/constants.js';
import { clamp01to100, fmt, fmtCurrency, fmtCurrencyForExport, fmtScore, inc18ToCompositeScore, toNumOrZero, todayDatePart } from './dashboard/format.js';
import { augmentYearlyRowsWithPartialFromSeasons } from './dashboard/yearlyPartials.js';

const DashboardOverviewTab = lazy(() => import('./dashboard/tabs/DashboardOverviewTab.jsx'));
const EmployeesTab = lazy(() => import('./dashboard/tabs/EmployeesTab.jsx'));
const SeasonTab = lazy(() => import('./dashboard/tabs/SeasonTab.jsx'));
const MonthlyTab = lazy(() => import('./dashboard/tabs/MonthlyTab.jsx'));
const YearlyTab = lazy(() => import('./dashboard/tabs/YearlyTab.jsx'));
const TemplateTab = lazy(() => import('./dashboard/tabs/TemplateTab.jsx'));

export default function DashboardPage({ activeTab }) {
  const navigate = useNavigate();
  const { seasonKey } = useParams();
  
  const [year, setYear] = useState(new Date().getFullYear());
  const [availableYears, setAvailableYears] = useState([]);
  const [showAddYearModal, setShowAddYearModal] = useState(false);
  const [newYear, setNewYear] = useState('');
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const [seasonSubTab, setSeasonSubTab] = useState('results'); // 'results', 'analytics', 'upload'
  
  const tab = seasonKey || activeTab || 'dashboard';

  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

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

  const [allSeasonsItems, setAllSeasonsItems] = useState([]);
  const [employeesData, setEmployeesData] = useState([]);

  // Combined upload item analytics (per season)
  const [combinedItemsBySeason, setCombinedItemsBySeason] = useState({});

  const [newEmployee, setNewEmployee] = useState({ firstName: '', lastName: '', surname: '', phone: '', email: '' });
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [newProduct, setNewProduct] = useState({ productName: '', minPrice: '' });
  const [templateProducts, setTemplateProducts] = useState([]);

  async function loadTemplateProducts(season = 'shiyadu') {
    setBusy(true);
    try {
      const res = await api.get(`/api/templates/${year}/${season}/combined/products`);
      setTemplateProducts(res.data.products || []);
    } catch (err) {
      console.error('Load products err:', err);
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteProduct(prodName, seasonOverride) {
    const targetSeason = seasonOverride || 'shiyadu';
    if (!window.confirm(`Are you sure you want to remove "${prodName}" from the master template? This will delete 9 columns from ${targetSeason === 'all' ? 'ALL seasons' : 'the template'}.`)) return;
    setBusy(true);
    try {
      await api.post(`/api/templates/${year}/${targetSeason}/combined/remove-product`, { productName: prodName });
      setMessage(`Product "${prodName}" removed successfully.`);
      await loadTemplateProducts('shiyadu');
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Delete failed');
    } finally {
      setBusy(false);
    }
  }
  const canEditBaseSalary = useMemo(() => {
    const m = {};
    for (const r of yearlyRows) {
      m[r.employeeName] = r.baseSalarySource === 'manual';
    }
    return m;
  }, [yearlyRows]);

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

  async function loadEmployees() {
    setBusy(true);
    try {
      const res = await api.get('/api/employees');
      setEmployeesData(res.data?.employees || []);
    } catch (err) {
      setError('Failed to load employee list');
    } finally {
      setBusy(false);
    }
  }

  function handleExportEmployees() {
    if (employeesData.length === 0) return;
    const datePart = todayDatePart();
    downloadExcel({
      filenameBase: `employee_details_${year}_${datePart}`,
      sheetName: `Employees ${year}`,
      columns: [
        { header: 'ID', key: 'empId' },
        { header: 'First Name', key: 'firstName' },
        { header: 'Last Name', key: 'lastName' },
        { header: 'Surname', key: 'surname' },
        { header: 'Phone', key: 'phone' },
        { header: 'Email', key: 'email' },
      ],
      rows: employeesData
    });
    setMessage(`Employee details for ${year} exported`);
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

  useEffect(() => {
    const rows = yearlyRowsView;
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

    const validIncrements = rows
      .filter((r) => r.finalIncrementPercent != null)
      .map((r) => r.adjustedFinalIncrement);
    const avgFinalIncrement = validIncrements.length > 0
      ? validIncrements.reduce((a, b) => a + b, 0) / validIncrements.length
      : 0;

    const totalSalaryBudget = rows.reduce(
      (sum, r) => sum + (r.adjustedTotalSalary || r.totalSalary || 0),
      0
    );

    const validScores = rows
      .filter((r) => r.adjustedCompositeScore != null)
      .map((r) => r.adjustedCompositeScore);
    const avgCompositeScore = validScores.length > 0
      ? validScores.reduce((a, b) => a + b, 0) / validScores.length
      : 0;

    const depsTotals = rows.reduce(
      (sum, r) => sum + (Number.isFinite(r.dependenciesTotal) ? r.dependenciesTotal : 5),
      0
    );
    const depsFilled = rows.reduce((sum, r) => {
      if (Number.isFinite(r.dependenciesFilled)) return sum + r.dependenciesFilled;
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
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get('/api/increments/years');
        const years = Array.isArray(res.data.years) ? res.data.years : [];
        if (!cancelled) setAvailableYears(years);
      } catch {
        if (!cancelled) setAvailableYears([]);
      }
    })();
    return () => {
      cancelled = true;
    };
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
    let cancelled = false;

    setError(null);
    setMessage(null);
    setCurrentPage(1);
    setBusy(true);

    const fetchData = async () => {
      try {
        if (SEASONS.some((s) => s.key === tab)) {
          const res = await api.get(`/api/increments/${year}/seasons/${tab}`);
          if (!cancelled) setSeasonRows(res.data.rows || []);
        } else if (tab === 'monthly') {
          const res = await api.get(`/api/increments/${year}/monthly/${abMonth}`);
          if (!cancelled) setMonthlyRows(res.data.rows || []);
        } else if (tab === 'yearly' || tab === 'dashboard') {
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
          if (!cancelled) {
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
        } else if (tab === 'template') {
          const res = await api.get(`/api/templates/${year}/shiyadu/combined/products`);
          if (!cancelled) setTemplateProducts(res.data.products || []);
        } else if (tab === 'employees') {
          const res = await api.get('/api/employees');
          if (!cancelled) setEmployeesData(res.data?.employees || []);
        }

        try {
          const res = await api.get(`/api/increments/${year}/uploaded-files`);
          if (!cancelled && res.data.success) {
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
      } catch (err) {
        if (!cancelled) {
          setError(err?.response?.data?.message || err?.message || 'Failed to load data');
        }
      } finally {
        if (!cancelled) setBusy(false);
      }
    };

    fetchData();
    return () => {
      cancelled = true;
    };
  }, [tab, year, abMonth]);

  useEffect(() => {

    setSeasonSubTab('results');
  }, [tab]);

  useEffect(() => {

    const handleClickOutside = (e) => {
      if (showExportDropdown && !e.target.closest('.export-dropdown-container')) {
        setShowExportDropdown(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showExportDropdown]);



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

  

  async function uploadSeasonMetricInternal(season, metric, file, opts = {}) {
    const { attemptedAuto = false, yearOverride = null } = opts;
    const yr = yearOverride ?? year;

    const form = new FormData();
    form.append('file', file);

    try {
      // Skip master template upload for dynamic metrics (Activity and Payment)
      const isDynamic = metric === 'activity' || metric === 'paymentCollection';
      
      if (!isDynamic) {
        try {
          const templateRes = await api.post(`/api/templates/${yr}/${season}/${metric}/upload`, form, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
          if (templateRes?.data?.employeeCount) {
            setMessage(`Template validated with ${templateRes.data.employeeCount} employee(s). Processing data...`);
          }
        } catch (templateErr) {
          throw new Error(templateErr?.response?.data?.error || 'Template validation failed');
        }
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

      if (Array.isArray(d.overallItems)) {
        setCombinedItemsBySeason((prev) => ({
          ...prev,
          [season]: {
            items: d.overallItems,
            employeesProcessed: d.employeesProcessed ?? null,
            updatedAt: new Date().toISOString(),
          },
        }));
      }

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

  async function loadCombinedItems(season) {
    try {
      const res = await api.get(`/api/increments/${year}/seasons/${season}/combined-items`);
      if (!res?.data?.success) return;
      setCombinedItemsBySeason((prev) => ({
        ...prev,
        [season]: {
          items: Array.isArray(res.data.overallItems) ? res.data.overallItems : [],
          employeesProcessed: res.data.employeesProcessed ?? null,
          updatedAt: res.data.updatedAt ?? null,
        },
      }));
    } catch (e) {
      // Keep UI quiet; the user still can download combined file.
      console.error('Failed to load combined item analytics', e);
    }
  }

  useEffect(() => {
    // Clear cached analytics when switching year
    setCombinedItemsBySeason({});
    setAllSeasonsItems([]);
  }, [year]);

  useEffect(() => {
    let cancelled = false;
    if (!SEASONS.some((s) => s.key === tab)) return;
    if (!uploadedFiles?.[`${tab}_combined`]) return;
    if (combinedItemsBySeason?.[tab]?.items?.length) return;

    (async () => {
      try {
        const res = await api.get(`/api/increments/${year}/seasons/${tab}/combined-items`);
        if (cancelled) return;
        if (!res?.data?.success) return;
        setCombinedItemsBySeason((prev) => ({
          ...prev,
          [tab]: {
            items: Array.isArray(res.data.overallItems) ? res.data.overallItems : [],
            employeesProcessed: res.data.employeesProcessed ?? null,
            updatedAt: res.data.updatedAt ?? null,
          },
        }));
      } catch (e) {
        console.error('Failed to load combined item analytics', e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [tab, year, uploadedFiles, combinedItemsBySeason]);

  async function loadAllSeasonsItemAnalytics() {
    try {
      const results = await Promise.all(
        SEASONS.map(s => api.get(`/api/increments/${year}/seasons/${s.key}/combined-items`).catch(() => null))
      );
      
      const aggregation = {};
      results.forEach(res => {
        if (!res?.data?.success) return;
        const items = res.data.overallItems || [];
        items.forEach(item => {
          const key = item.productKey;
          if (!aggregation[key]) {
            aggregation[key] = { ...item, totalAmount: 0, parties: 0 };
          }
          aggregation[key].totalAmount += (item.totalAmount || 0);
          aggregation[key].parties += (item.parties || 0);
        });
      });
      
      const combined = Object.values(aggregation).sort((a, b) => b.totalAmount - a.totalAmount);
      setAllSeasonsItems(combined);
    } catch (e) {
      console.error('Failed to load overall item analytics', e);
    }
  }

  useEffect(() => {
    let cancelled = false;
    if (tab !== 'dashboard') return;

    (async () => {
      try {
        const results = await Promise.all(
          SEASONS.map((s) =>
            api.get(`/api/increments/${year}/seasons/${s.key}/combined-items`).catch(() => null)
          )
        );
        if (cancelled) return;

        const aggregation = {};
        results.forEach((res) => {
          if (!res?.data?.success) return;
          const items = res.data.overallItems || [];
          items.forEach((item) => {
            const key = item.productKey;
            if (!aggregation[key]) {
              aggregation[key] = { ...item, totalAmount: 0, parties: 0 };
            }
            aggregation[key].totalAmount += (item.totalAmount || 0);
            aggregation[key].parties += (item.parties || 0);
          });
        });

        const combined = Object.values(aggregation).sort((a, b) => b.totalAmount - a.totalAmount);
        setAllSeasonsItems(combined);
      } catch (e) {
        console.error('Failed to load overall item analytics', e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [tab, year]);

  async function handleTemplateUpload(season, metric, file) {
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await api.post(
        `/api/templates/${year}/${season}/${metric}/upload`,
        form,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      setMessage(res.data.message || 'Template uploaded successfully');
      // Refresh files to update UI if needed
      await loadUploadedFiles().catch(() => {});
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Template upload failed');
    } finally {
      setBusy(false);
    }
  }



  async function createEmployeeFromDashboard() {
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const payload = {
        firstName: (newEmployee.firstName || '').trim(),
        lastName: (newEmployee.lastName || '').trim(),
        surname: (newEmployee.surname || '').trim(),
        phone: (newEmployee.phone || '').trim(),
        email: (newEmployee.email || '').trim(),
      };
      if (!payload.firstName) throw new Error('First Name is required');
      if (!payload.email) throw new Error('Email is required');
      if (!/^\d{10}$/.test(payload.phone)) {
        throw new Error('Phone Number must be exactly 10 digits');
      }

      const res = await api.post('/api/employees', payload);
      const displayName = [payload.firstName, payload.lastName, payload.surname].filter(Boolean).join(' ').trim();
      const tpl = res?.data?.templates;
      const tplMsg = tpl
        ? ` • Templates: updated ${tpl.updated}/${tpl.scanned}`
        : '';
      setMessage(`Employee added: ${displayName} (ID: ${res.data.empId})${tplMsg}`);
      setNewEmployee({ firstName: '', lastName: '', surname: '', phone: '', email: '' });
      loadEmployees(); // Refresh list
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Failed to add employee');
    } finally {
      setBusy(false);
    }
  }

  async function updateEmployee() {
    if (!editingEmployee) return;
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      await api.patch(`/api/employees/${editingEmployee._id}`, editingEmployee);
      setMessage('Employee profile updated successfully');
      setShowEditModal(false);
      setEditingEmployee(null);
      setShowEditPassword(false);
      await loadEmployees();
      await loadYearly();
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Update failed');
    } finally {
      setBusy(false);
    }
  }

  async function handleAddItemToCombined(seasonOverride) {
    const targetSeason = seasonOverride || 'shiyadu';
    if (!newProduct.productName || !newProduct.minPrice) return;
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      await api.post(`/api/templates/${year}/${targetSeason}/combined/add-product`, newProduct);
      setMessage(`Successfully added "${newProduct.productName}" to the master template.`);
      setNewProduct({ productName: '', minPrice: '' });
      await loadTemplateProducts('shiyadu');
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Failed to add item');
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
    setMessage(null);
    setError(null);
    try {
      const url = metric === 'activity' 
        ? '/api/templates/activity/download'
        : `/api/templates/${year}/${season}/${metric}/download`;
        
      const res = await api.get(url, {
        responseType: 'blob'
      });
      
      const blob = new Blob([res.data]);
      const urlObj = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = urlObj;
      a.download = metric === 'activity' ? 'Activity_Template.xlsx' : `${season}_${metric}_template.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(urlObj);
      
      setMessage(`Template downloaded successfully`);
      setError(null);
    } catch (err) {
      setError(err?.response?.data?.message || 'Template not available. Please ensure employees are registered first.');
      setMessage(null);
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
    <>
      {tab !== 'template' && (
        <div className="card fade-in" style={{ 
          display: 'flex', flexWrap: 'wrap', alignItems: 'center', 
          justifyContent: 'space-between', gap: '1rem', marginBottom: '2rem', 
          padding: '1.25rem 1.75rem', overflow: 'visible',
          position: 'relative', zIndex: 50
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ 
              fontSize: '1.5rem', background: 'var(--primary-soft)', color: 'var(--primary)',
              width: '40px', height: '40px', borderRadius: '10px',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              {tab === 'dashboard' ? <LayoutDashboard size={20} /> : tab === 'monthly' ? <CalIcon size={20} /> : tab === 'yearly' ? <TrendingUp size={20} /> : tab === 'employees' ? <Users size={20} /> : <BarChart2 size={20} />}
            </div>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '700', margin: 0, color: 'var(--text)', textTransform: 'capitalize' }}>
                {tab === 'dashboard' ? 'Analytics Overview' : tab}
              </h2>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <select
              className="select input-sm"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              style={{ width: '100px', fontWeight: 600 }}
              disabled={busy}
            >
              {Array.from(new Set([year, ...availableYears])).sort((a, b) => b - a).map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <button onClick={() => setShowAddYearModal(true)} disabled={busy} className="btn btn-secondary" style={{ padding: '0.5rem 1rem' }}>
              <Plus size={16} /> <span style={{ display: window.innerWidth <= 480 ? 'none' : 'inline' }}>Year</span>
            </button>
            
            <div className="export-dropdown-container" style={{ position: 'relative' }}>
              {tab === 'employees' ? (
                <button onClick={handleExportEmployees} className="btn btn-primary" disabled={busy || employeesData.length === 0} style={{ padding: '0.5rem 1.5rem', borderRadius: '12px', background: 'var(--success)', border: 'none', boxShadow: '0 8px 16px rgba(16, 185, 129, 0.2)' }}>
                  <Download size={18} /> <span style={{ fontWeight: '700' }}>Export Details</span>
                </button>
              ) : (
                <>
                  <button onClick={() => setShowExportDropdown(!showExportDropdown)} className="btn btn-primary" disabled={busy} style={{ padding: '0.5rem 1rem' }}>
                    <Download size={16} /> <span style={{ display: window.innerWidth <= 480 ? 'none' : 'inline' }}>Export</span>
                  </button>
                  {showExportDropdown && (
                    <div style={{ 
                      position: 'absolute', top: 'calc(100% + 0.5rem)', right: 0, 
                      background: 'var(--surface)', border: '1px solid var(--primary-light)', 
                      borderRadius: '12px', boxShadow: '0 15px 30px rgba(0,0,0,0.15), 0 5px 15px rgba(0,0,0,0.1)', 
                      zIndex: 1000, minWidth: '200px', overflow: 'hidden', padding: '6px'
                    }}>
                      <button onClick={() => { handleDownloadFullYearExcel(); setShowExportDropdown(false); }} className="dropdown-item">
                        <FileSpreadsheet size={16} color="var(--primary)" /> 
                        <span>Excel Report</span>
                      </button>
                      <button onClick={() => { handleDownloadFullYearPdf(); setShowExportDropdown(false); }} className="dropdown-item">
                        <FileText size={16} color="var(--danger)" /> 
                        <span>PDF Report</span>
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="fade-in">
        {message && (
          <div className="alert alert-success">
            <span style={{ fontSize: '1.2rem' }}>✓</span>
            <span>{message}</span>
          </div>
        )}
        {error && (
          <div className="alert alert-error">
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
          <Suspense fallback={<div className="card">Loading...</div>}>
            <DashboardOverviewTab
              year={year}
              dashboardStats={dashboardStats}
              yearlyRowsView={yearlyRowsView}
              allSeasonsItems={allSeasonsItems}
            />
          </Suspense>
        )}

        {tab === 'employees' && (
          <Suspense fallback={<div className="card">Loading...</div>}>
            <EmployeesTab
              busy={busy}
              newEmployee={newEmployee}
              setNewEmployee={setNewEmployee}
              createEmployeeFromDashboard={createEmployeeFromDashboard}
              employeesData={employeesData}
              setEditingEmployee={setEditingEmployee}
              setShowEditModal={setShowEditModal}
              showEditModal={showEditModal}
              editingEmployee={editingEmployee}
              showEditPassword={showEditPassword}
              setShowEditPassword={setShowEditPassword}
              updateEmployee={updateEmployee}
            />
          </Suspense>
        )}

        {/* Season View */}
        {SEASONS.some((s) => s.key === tab) && (
          <Suspense fallback={<div className="card">Loading...</div>}>
            <SeasonTab
              tab={tab}
              seasonSubTab={seasonSubTab}
              setSeasonSubTab={setSeasonSubTab}
              seasonRows={seasonRows}
              busy={busy}
              handleDownloadExcel={handleDownloadExcel}
              handleDownloadPdf={handleDownloadPdf}
              getPaginatedData={getPaginatedData}
              fmt={fmt}
              renderPagination={renderPagination}
              downloadSeasonFile={downloadSeasonFile}
              uploadedFiles={uploadedFiles}
              combinedItemsBySeason={combinedItemsBySeason}
              uploadCombined={uploadCombined}
              downloadTemplate={downloadTemplate}
              uploadSeasonMetric={uploadSeasonMetric}
            />
          </Suspense>
        )}



        {/* Monthly View */}
        {tab === 'monthly' && (
          <Suspense fallback={<div className="card">Loading...</div>}>
            <MonthlyTab
              busy={busy}
              abMonth={abMonth}
              setAbMonth={setAbMonth}
              monthlyRows={monthlyRows}
              getPaginatedData={getPaginatedData}
              fmt={fmt}
              renderPagination={renderPagination}
              downloadTemplate={downloadTemplate}
              uploadYearly={uploadYearly}
              handleDownloadExcel={handleDownloadExcel}
              handleDownloadPdf={handleDownloadPdf}
            />
          </Suspense>
        )}

        {/* Yearly View */}
        {tab === 'yearly' && (
          <Suspense fallback={<div className="card">Loading...</div>}>
            <YearlyTab
              busy={busy}
              yearlyRows={yearlyRows}
              yearlyRowsView={yearlyRowsView}
              getPaginatedData={getPaginatedData}
              renderPagination={renderPagination}
              handleDownloadExcel={handleDownloadExcel}
              handleDownloadPdf={handleDownloadPdf}
              saveBaseSalaries={saveBaseSalaries}
              behaviourOverrides={behaviourOverrides}
              behaviourConfirmed={behaviourConfirmed}
              handleBehaviourNo={handleBehaviourNo}
              handleBehaviourYes={handleBehaviourYes}
              canEditBaseSalary={canEditBaseSalary}
              baseSalaryEdits={baseSalaryEdits}
              setBaseSalaryEdits={setBaseSalaryEdits}
            />
          </Suspense>
        )}

        {tab === 'template' && (
          <Suspense fallback={<div className="card">Loading...</div>}>
            <TemplateTab
              busy={busy}
              newProduct={newProduct}
              setNewProduct={setNewProduct}
              handleAddItemToCombined={handleAddItemToCombined}
              templateProducts={templateProducts}
              handleDeleteProduct={handleDeleteProduct}
            />
          </Suspense>
        )}
      </div>

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

    </>
  );
}
