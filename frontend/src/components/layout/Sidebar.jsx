import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, Calendar, TrendingUp, BarChart2, FileSpreadsheet, Settings, Plus } from 'lucide-react';

export default function Sidebar({ user, isOpen, toggleSidebar }) {
  const isEmployee = user?.role === 'employee';

  const allItems = [
    { name: 'Analytics', path: '/', icon: <LayoutDashboard size={20} />, adminOnly: true },
    { name: 'Shiyadu', path: '/season/shiyadu', icon: <BarChart2 size={20} />, adminOnly: true },
    { name: 'Unadu', path: '/season/unadu', icon: <BarChart2 size={20} />, adminOnly: true },
    { name: 'Chomasu', path: '/season/chomasu', icon: <BarChart2 size={20} />, adminOnly: true },
    { name: 'Monthly', path: '/monthly', icon: <Calendar size={20} />, adminOnly: true },
    { name: 'Yearly Summary', path: '/yearly', icon: <TrendingUp size={20} />, adminOnly: true },
    { name: 'Add Product', path: '/template-manager', icon: <Plus size={20} />, adminOnly: true },
    { name: 'My Performance', path: '/employee', icon: <Users size={20} />, employeeOnly: true },
    { name: 'Manage Employees', path: '/employee', icon: <Users size={20} />, adminOnly: true },
  ];

  const navItems = allItems.filter(item => {
    if (isEmployee) return item.employeeOnly;
    return item.adminOnly;
  });


  return (
    <>
      {/* Mobile overlay */}
      {isOpen && <div className="sidebar-overlay" onClick={toggleSidebar} />}
      
      <aside className={`app-sidebar ${isOpen ? 'open' : ''}`}>
        <div style={{ padding: '2rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', borderBottom: '1px solid var(--border)' }}>
          <div style={{
            width: '40px', height: '40px', borderRadius: '12px',
            background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))',
            color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 'bold', fontSize: '1.2rem', boxShadow: '0 4px 10px rgba(5, 150, 105, 0.3)'
          }}>
            S
          </div>
          <div>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: 'var(--text)' }}>Savan Seed</h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-light)', margin: 0 }}>
              {isEmployee ? 'Employee Portal' : 'Dashboard Admin'}
            </p>
          </div>
        </div>

        <nav style={{ padding: '1.5rem 0', display: 'flex', flexDirection: 'column', gap: '0.25rem', flex: 1, overflowY: 'auto' }}>
          {navItems.map((item) => (
            <NavLink
              key={item.name}
              to={item.path}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              onClick={() => {
                if (window.innerWidth <= 1024) toggleSidebar();
              }}
            >
              {item.icon}
              {item.name}
            </NavLink>
          ))}
        </nav>
        
        <div style={{ padding: '1.5rem', borderTop: '1px solid var(--border)' }}>
          <div className="card" style={{ padding: '1rem', background: 'var(--primary-softer)', border: 'none', boxShadow: 'none' }}>
            <p style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text)', margin: '0 0 0.5rem 0' }}>Need Help?</p>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-light)', margin: '0 0 1rem 0' }}>Check the docs or contact support.</p>
            <button className="btn btn-primary" style={{ width: '100%', padding: '0.5rem', fontSize: '0.8rem' }}>Documentation</button>
          </div>
        </div>
      </aside>
    </>
  );
}
