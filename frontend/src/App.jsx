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

  async function checkAuth(showSpinner = true) {
    if (showSpinner) setChecking(true);
    try {
      const res = await api.get('/api/auth/me');
      const u = res.data?.user || null;
      setUser(u);
      setAuthed(Boolean(u));
    } catch {
      setAuthed(false);
      setUser(null);
    } finally {
      if (showSpinner) setChecking(false);
    }
  }

  useEffect(() => {
    checkAuth(true);
  }, []);

  if (checking) {
    return (
      <div style={{ padding: 16, display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'var(--bg)' }}>
        <div className="spinner spinner-primary"></div>
      </div>
    );
  }

  const handleLogout = async () => {
    try {
      await api.post('/api/auth/logout');
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      localStorage.removeItem('token');
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
              <Navigate to={user?.role === 'employee' ? '/employee' : '/'} replace />
            ) : (
              <LoginPage onLoggedIn={() => checkAuth(false)} />
            )
          }
        />

        {/* Protected Dashboard Routes wrapped in Layout */}
        <Route
          element={
            authed ? (
              <AppLayout user={user} onLogout={handleLogout} />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        >
          <Route
            path="/"
            element={
              user?.role === 'employee' ? <Navigate to="/employee" replace /> : <DashboardPage activeTab="dashboard" />
            }
          />
          <Route
            path="/season/:seasonKey"
            element={
              user?.role === 'employee' ? <Navigate to="/employee" replace /> : <DashboardPage />
            }
          />
          <Route
            path="/monthly"
            element={
              user?.role === 'employee' ? <Navigate to="/employee" replace /> : <DashboardPage activeTab="monthly" />
            }
          />
          <Route
            path="/yearly"
            element={
              user?.role === 'employee' ? <Navigate to="/employee" replace /> : <DashboardPage activeTab="yearly" />
            }
          />
          <Route
            path="/template-manager"
            element={
              user?.role === 'employee' ? <Navigate to="/employee" replace /> : <DashboardPage activeTab="template" />
            }
          />
          <Route
            path="/employee"
            element={
              user?.role === 'employee' ? <EmployeePage /> : <DashboardPage activeTab="employees" />
            }
          />
        </Route>

        <Route path="*" element={<Navigate to={authed ? (user?.role === 'employee' ? '/employee' : '/') : '/login'} replace />} />
      </Routes>
    </BrowserRouter>
  );
}
