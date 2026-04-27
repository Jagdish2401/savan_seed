import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { api } from './lib/api';
import DashboardPage from './pages/DashboardPage';
import LoginPage from './pages/LoginPage';
import EmployeePage from './pages/EmployeePage';
import AppLayout from './components/layout/AppLayout';

export default function App() {
  const [checking, setChecking] = useState(true);
  const [authed, setAuthed] = useState(false);
  const [user, setUser] = useState(null); // { role, employeeId, employeeName }

  async function checkAuth() {
    setChecking(true);
    try {
      const res = await api.get('/api/auth/me');
      const u = res.data?.user || null;
      setUser(u);
      setAuthed(Boolean(u));
    } catch {
      setAuthed(false);
      setUser(null);
    } finally {
      setChecking(false);
    }
  }

  useEffect(() => {
    checkAuth();
  }, []);

  if (checking) return <div style={{ padding: 16, display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'var(--bg)' }}><div className="spinner spinner-primary"></div></div>;

  const handleLogout = async () => {
    try {
      await api.post('/api/auth/logout');
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setAuthed(false);
      setUser(null);
    }
  };

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={
            authed ? (
              user?.role === 'employee' ? <Navigate to="/employee" replace /> : <Navigate to="/" replace />
            ) : (
              <LoginPage onLoggedIn={async () => { await checkAuth(); }} />
            )
          }
        />
        
        {/* Protected Dashboard Routes wrapped in Layout */}
        {authed && user?.role !== 'employee' && (
          <Route element={<AppLayout user={user} onLogout={handleLogout} />}>
            <Route path="/" element={<DashboardPage activeTab="dashboard" />} />
            <Route path="/season/:seasonKey" element={<DashboardPage />} />
            <Route path="/monthly" element={<DashboardPage activeTab="monthly" />} />
            <Route path="/yearly" element={<DashboardPage activeTab="yearly" />} />
            <Route path="/employee" element={<DashboardPage activeTab="employees" />} />
            <Route path="/template-manager" element={<DashboardPage activeTab="template" />} />
          </Route>
        )}

        {/* Protected Employee Route */}
        {authed && user?.role === 'employee' && (
          <Route element={<AppLayout user={user} onLogout={handleLogout} />}>
            <Route path="/employee" element={<EmployeePage />} />
          </Route>
        )}

        <Route path="*" element={<Navigate to={authed ? (user?.role === 'employee' ? '/employee' : '/') : '/login'} replace />} />
      </Routes>
    </BrowserRouter>
  );
}
