import { useState } from 'react';
import { Leaf, Lock } from 'lucide-react';
import { api } from '../lib/api';

export default function LoginPage({ onLoggedIn }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api.post('/api/auth/login', { email, password });
      await api.get('/api/auth/me');
      await onLoggedIn();
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-split">
      <div className="auth-split-visual">
        <div style={{ position: 'relative', zIndex: 10, textAlign: 'center', color: 'white', padding: '2rem' }}>
          <div style={{ background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(10px)', padding: '1.5rem', borderRadius: '24px', display: 'inline-block', marginBottom: '2rem', border: '1px solid rgba(255,255,255,0.4)' }}>
            <Leaf size={64} color="white" />
          </div>
          <h1 style={{ fontSize: '3.5rem', fontWeight: 900, marginBottom: '1rem', letterSpacing: '-0.02em', textShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>Savan Seed</h1>
          <p style={{ fontSize: '1.25rem', opacity: 0.9, maxWidth: '400px', margin: '0 auto', lineHeight: 1.6 }}>
            Premium Seed Management & Employee Analytics Platform
          </p>
        </div>
      </div>
      <div className="auth-split-form">
        <div style={{ width: '100%', maxWidth: '400px' }} className="fade-in">
          <div style={{ marginBottom: '2.5rem' }}>
            <h2 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text)', marginBottom: '0.5rem' }}>Welcome back</h2>
            <p style={{ color: 'var(--text-light)', fontSize: '1rem' }}>Please enter your details to sign in.</p>
          </div>

          {error && (
            <div className="alert alert-error" style={{ marginBottom: '2rem' }}>
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div className="input-group">
              <label>Email or Employee ID</label>
              <input
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="text"
                placeholder="e.g. hr@gmail.com or SS01"
                required
                disabled={loading}
              />
            </div>

            <div className="input-group">
              <label>Password</label>
              <input
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                placeholder="••••••••"
                required
                autoComplete="current-password"
                disabled={loading}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '-0.5rem', marginBottom: '1rem' }}>
              <a href="#" style={{ fontSize: '0.875rem', color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' }}>Forgot password?</a>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{ width: '100%', padding: '0.875rem', fontSize: '1.05rem' }}
            >
              {loading ? (
                <><span className="spinner" /> Signing in...</>
              ) : (
                <><Lock size={18} /> Sign In</>
              )}
            </button>
          </form>

          <div style={{
            marginTop: '3rem',
            padding: '1.5rem',
            background: 'var(--surface-hover)',
            borderRadius: '16px',
            fontSize: '0.875rem',
            color: 'var(--text-light)',
            border: '1px solid var(--border)'
          }}>
            <div style={{ marginBottom: '0.75rem', fontWeight: 600, color: 'var(--text)' }}>
              Demo Credentials
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontFamily: 'monospace' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Email:</span> <strong style={{ color: 'var(--primary)' }}>hr@gmail.com</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Password:</span> <strong>savan@123</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
