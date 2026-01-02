import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { api } from './lib/api';
import DashboardPage from './pages/DashboardPage';
import LoginPage from './pages/LoginPage';
import EmployeePage from './pages/EmployeePage';

export default function App() {
  const [checking, setChecking] = useState(true);
  const [authed, setAuthed] = useState(false);
  const [user, setUser] = useState(null); // { role, employeeId, employeeName }

  async function checkAuth() {
    setChecking(true);
    try {
      const res = await api.get('/api/auth/me');
      setAuthed(true);
      setUser(res.data?.user || null);
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

  if (checking) return <div style={{ padding: 16 }}>Loading…</div>;

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={
            authed ? (
              user?.role === 'employee' ? <Navigate to="/employee" replace /> : <Navigate to="/" replace />
            ) : (
              <LoginPage onLoggedIn={(role) => { setAuthed(true); setUser({ role }); }} />
            )
          }
        />
        <Route
          path="/"
          element={
            authed
              ? user?.role === 'employee'
                ? <Navigate to="/employee" replace />
                : <DashboardPage onLogout={() => { setAuthed(false); setUser(null); }} />
              : <Navigate to="/login" replace />
          }
        />
        <Route
          path="/employee"
          element={
            authed
              ? user?.role === 'employee'
                ? <EmployeePage onLogout={() => { setAuthed(false); setUser(null); }} />
                : <Navigate to="/" replace />
              : <Navigate to="/login" replace />
          }
        />
        <Route path="*" element={<Navigate to={authed && user?.role === 'employee' ? '/employee' : '/'} replace />} />
      </Routes>
    </BrowserRouter>
  );
}
