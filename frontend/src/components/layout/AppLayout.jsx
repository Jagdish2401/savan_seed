import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import ProfileModal from './ProfileModal';

export default function AppLayout({ user, onLogout }) {
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved === 'true';
  });

  const [isProfileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
    localStorage.setItem('darkMode', darkMode);
  }, [darkMode]);

  return (
    <div className="app-layout">
      <Sidebar user={user} isOpen={isSidebarOpen} toggleSidebar={() => setSidebarOpen(!isSidebarOpen)} />
      
      <main className="app-main">
        <Header 
          toggleSidebar={() => setSidebarOpen(!isSidebarOpen)} 
          user={user} 
          onLogout={onLogout}
          darkMode={darkMode}
          toggleDarkMode={() => setDarkMode(!darkMode)}
          openProfile={() => setProfileOpen(true)}
        />
        <div className="app-content">
          <div className="container">
            <Outlet />
          </div>
        </div>
      </main>
      
      <ProfileModal 
        isOpen={isProfileOpen} 
        onClose={() => setProfileOpen(false)} 
        user={user}
        onUpdate={() => window.location.reload()} // Quick way to refresh header name
      />
    </div>
  );
}
