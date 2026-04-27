import { Menu, Moon, Sun, LogOut, Bell } from 'lucide-react';

export default function Header({ toggleSidebar, user, onLogout, toggleDarkMode, darkMode, openProfile }) {
  return (
    <header className="app-header">
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <button 
          className="btn-icon" 
          onClick={toggleSidebar}
          style={{ display: window.innerWidth > 1024 ? 'none' : 'flex' }}
        >
          <Menu size={24} />
        </button>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: 'var(--text)' }}>
          Overview
        </h1>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <button className="btn-icon" title="Notifications">
          <Bell size={20} />
        </button>
        
        <button className="btn-icon" onClick={toggleDarkMode} title={darkMode ? "Light Mode" : "Dark Mode"}>
          {darkMode ? <Sun size={20} /> : <Moon size={20} />}
        </button>

        <div style={{ width: '1px', height: '24px', background: 'var(--border)', margin: '0 0.5rem' }} />

        <div 
          style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}
          onClick={openProfile}
          title="Edit Profile"
          className="header-user-profile"
        >
          <div style={{ textAlign: 'right', display: window.innerWidth <= 480 ? 'none' : 'block' }}>
            <p style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)', margin: 0 }}>
              {user?.employeeName || 'Admin User'}
            </p>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-light)', margin: 0 }}>
              {user?.role === 'employee' ? 'Employee' : 'Administrator'}
            </p>
          </div>
          <div style={{ 
            width: '36px', height: '36px', borderRadius: '50%', 
            background: 'var(--primary-soft)', color: 'var(--primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, fontSize: '1rem', border: '2px solid var(--border)',
            transition: 'all 0.2s ease'
          }}>
            {user?.employeeName ? user.employeeName[0].toUpperCase() : 'A'}
          </div>
        </div>

        <button 
          onClick={onLogout}
          className="btn btn-secondary" 
          style={{ padding: '0.4rem 0.75rem', marginLeft: '0.5rem' }}
          title="Logout"
        >
          <LogOut size={16} />
          <span style={{ display: window.innerWidth <= 768 ? 'none' : 'inline' }}>Logout</span>
        </button>
      </div>
    </header>
  );
}
