import { useState } from 'react';
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
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '1rem',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Animated background shapes */}
      <div style={{
        position: 'absolute',
        width: '400px',
        height: '400px',
        background: 'rgba(255, 255, 255, 0.1)',
        borderRadius: '50%',
        top: '-200px',
        left: '-200px',
        animation: 'pulse 4s ease-in-out infinite'
      }} />
      <div style={{
        position: 'absolute',
        width: '300px',
        height: '300px',
        background: 'rgba(255, 255, 255, 0.1)',
        borderRadius: '50%',
        bottom: '-150px',
        right: '-150px',
        animation: 'pulse 5s ease-in-out infinite'
      }} />
      
      <div className="card" style={{ maxWidth: '420px', width: '100%', position: 'relative', zIndex: 1 }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            width: '80px',
            height: '80px',
            background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1rem',
            fontSize: '2.5rem',
            boxShadow: 'var(--shadow-lg)',
            animation: 'fadeIn 0.5s ease-out'
          }}>
            🌾
          </div>
          <h1 style={{ 
            fontSize: '1.875rem', 
            fontWeight: '700', 
            marginBottom: '0.5rem', 
            color: 'var(--text)',
            animation: 'fadeIn 0.6s ease-out'
          }}>
            Employee Increment System
          </h1>
          <p style={{ 
            color: 'var(--text-light)', 
            fontSize: '0.95rem',
            animation: 'fadeIn 0.7s ease-out'
          }}>
            Sign in to access the HR dashboard
          </p>
        </div>

        {error && (
          <div className="alert alert-error">
            <span style={{ fontSize: '1.2rem' }}>⚠️</span>
            <span><strong>Error:</strong> {error}</span>
          </div>
        )}

        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ animation: 'fadeIn 0.8s ease-out' }}>
            <label style={{ display: 'block', fontWeight: '500', marginBottom: '0.5rem', fontSize: '0.95rem' }}>
              Email Address
            </label>
            <input
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              placeholder="hr@gmail.com"
              required
              autoComplete="email"
              disabled={loading}
            />
          </div>

          <div style={{ animation: 'fadeIn 0.9s ease-out' }}>
            <label style={{ display: 'block', fontWeight: '500', marginBottom: '0.5rem', fontSize: '0.95rem' }}>
              Password
            </label>
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
            style={{ 
              width: '100%', 
              padding: '0.75rem',
              animation: 'fadeIn 1s ease-out',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem'
            }}
          >
            {loading ? (
              <>
                <span className="spinner" />
                <span>Signing in...</span>
              </>
            ) : (
              <>
                <span>🔐</span>
                <span>Sign In</span>
              </>
            )}
          </button>
        </form>

        <div style={{ 
          marginTop: '1.5rem', 
          paddingTop: '1.5rem', 
          borderTop: '1px solid var(--border)', 
          fontSize: '0.875rem', 
          color: 'var(--text-light)', 
          textAlign: 'center',
          animation: 'fadeIn 1.1s ease-out'
        }}>
          <div style={{ marginBottom: '0.5rem', color: 'var(--text-lighter)' }}>
            Default credentials for testing:
          </div>
          <div style={{ 
            background: 'var(--bg)', 
            padding: '0.75rem', 
            borderRadius: '0.5rem',
            fontFamily: 'monospace'
          }}>
            <div><strong>Email:</strong> hr@gmail.com</div>
            <div><strong>Password:</strong> savan@123</div>
          </div>
        </div>
      </div>
    </div>
  );
}
