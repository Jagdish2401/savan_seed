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
      const res = await api.post('/api/auth/login', { email, password });
      if (res.data?.token) {
        localStorage.setItem('token', res.data.token);
      }
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
            marginTop: '2.5rem',
            borderRadius: '20px',
            overflow: 'hidden',
            border: '1px solid rgba(5,150,105,0.2)',
            boxShadow: '0 8px 32px rgba(5,150,105,0.08), 0 2px 8px rgba(0,0,0,0.04)',
            background: 'var(--surface)',
          }}>
            {/* Card Header */}
            <div style={{
              background: 'linear-gradient(135deg, #059669 0%, #10b981 50%, #34d399 100%)',
              padding: '0.9rem 1.25rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
            }}>
              <div style={{
                width: 28, height: 28,
                background: 'rgba(255,255,255,0.25)',
                borderRadius: '8px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.9rem',
              }}>🔑</div>
              <span style={{ color: '#fff', fontWeight: 700, fontSize: '0.875rem', letterSpacing: '0.02em' }}>
                Demo Credentials
              </span>
              <span style={{
                marginLeft: 'auto',
                background: 'rgba(255,255,255,0.2)',
                color: '#fff',
                fontSize: '0.7rem',
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: '20px',
                letterSpacing: '0.04em',
              }}>HR</span>
            </div>

            {/* Card Body */}
            <div style={{ padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {/* Email Row */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'var(--primary-softer)',
                border: '1px solid rgba(5,150,105,0.12)',
                borderRadius: '10px',
                padding: '0.55rem 0.875rem',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-light)', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Email</span>
                </div>
                <span style={{
                  fontFamily: 'monospace',
                  fontSize: '0.875rem',
                  fontWeight: 700,
                  color: 'var(--primary)',
                  background: 'rgba(5,150,105,0.08)',
                  padding: '2px 10px',
                  borderRadius: '6px',
                  letterSpacing: '0.01em',
                }}>hr@gmail.com</span>
              </div>

              {/* Password Row */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'var(--primary-softer)',
                border: '1px solid rgba(5,150,105,0.12)',
                borderRadius: '10px',
                padding: '0.55rem 0.875rem',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-light)', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Password</span>
                </div>
                <span style={{
                  fontFamily: 'monospace',
                  fontSize: '0.875rem',
                  fontWeight: 700,
                  color: 'var(--text)',
                  background: 'rgba(5,150,105,0.08)',
                  padding: '2px 10px',
                  borderRadius: '6px',
                  letterSpacing: '0.04em',
                }}>savan@123</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
