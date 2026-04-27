import {
  Edit,
  Lock,
  Mail,
  Phone,
  ShieldCheck,
  User,
  UserCheck,
  UserPlus,
  Users,
} from 'lucide-react';

export default function EmployeesTab({
  busy,
  newEmployee,
  setNewEmployee,
  createEmployeeFromDashboard,
  employeesData,
  setEditingEmployee,
  setShowEditModal,
  showEditModal,
  editingEmployee,
  updateEmployee,
}) {
  return (
    <>
      <div className="fade-in">
        <div className="card" style={{ padding: '2rem', borderRadius: '24px', boxShadow: '0 10px 40px rgba(0,0,0,0.06)', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', marginBottom: '2.5rem' }}>
            <div style={{
              background: 'linear-gradient(135deg, var(--primary), #10b981)',
              color: 'white',
              width: '56px',
              height: '56px',
              borderRadius: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.75rem',
              boxShadow: '0 8px 16px rgba(22, 163, 74, 0.25)'
            }}>
              <UserPlus size={28} />
            </div>
            <div style={{ flex: 1 }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: '800', margin: 0, color: 'var(--text)', letterSpacing: '-0.02em' }}>
                Hire New Talent
              </h2>
              <p style={{ fontSize: '0.95rem', color: 'var(--text-light)', margin: '0.25rem 0 0 0' }}>
                Create employee profiles and automatically generate their personalized Excel worksheets.
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '2rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--primary)', margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Users size={18} /> Personal Details
              </h3>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.6rem', color: 'var(--text-light)' }}>First Name <span style={{ color: 'var(--danger)' }}>*</span></label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }}><User size={16} /></span>
                  <input
                    className="input"
                    value={newEmployee.firstName}
                    onChange={(e) => setNewEmployee((p) => ({ ...p, firstName: e.target.value }))}
                    placeholder="e.g. Narsinhbhai"
                    disabled={busy}
                    style={{ paddingLeft: '40px', borderRadius: '12px', height: '48px', border: '1.5px solid var(--border)' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.6rem', color: 'var(--text-light)' }}>Last Name</label>
                  <input
                    className="input"
                    value={newEmployee.lastName}
                    onChange={(e) => setNewEmployee((p) => ({ ...p, lastName: e.target.value }))}
                    placeholder="K."
                    disabled={busy}
                    style={{ borderRadius: '12px', height: '48px', border: '1.5px solid var(--border)' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.6rem', color: 'var(--text-light)' }}>Surname</label>
                  <input
                    className="input"
                    value={newEmployee.surname}
                    onChange={(e) => setNewEmployee((p) => ({ ...p, surname: e.target.value }))}
                    placeholder="Patel"
                    disabled={busy}
                    style={{ borderRadius: '12px', height: '48px', border: '1.5px solid var(--border)' }}
                  />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--primary)', margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ShieldCheck size={18} /> Contact & Access
              </h3>

              <div>
                <label style={{ display: 'flex', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.6rem', color: 'var(--text-light)', justifyContent: 'space-between' }}>
                  <span>Phone Number <span style={{ color: 'var(--danger)' }}>*</span></span>
                  <span style={{ fontSize: '0.75rem', color: newEmployee.phone.length === 10 ? 'var(--success)' : 'var(--text-light)' }}>
                    {newEmployee.phone.length}/10 Digits
                  </span>
                </label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }}><Phone size={16} /></span>
                  <input
                    className="input"
                    value={newEmployee.phone}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                      setNewEmployee((p) => ({ ...p, phone: val }));
                    }}
                    placeholder="9999999999"
                    disabled={busy}
                    style={{
                      paddingLeft: '40px',
                      borderRadius: '12px',
                      height: '48px',
                      border: newEmployee.phone.length > 0 && newEmployee.phone.length < 10 ? '1.5px solid var(--danger)' : '1.5px solid var(--border)',
                      borderColor: newEmployee.phone.length === 10 ? 'var(--success)' : undefined
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.6rem', color: 'var(--text-light)' }}>Login Email <span style={{ color: 'var(--danger)' }}>*</span></label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }}><Mail size={16} /></span>
                  <input
                    className="input"
                    type="email"
                    value={newEmployee.email}
                    onChange={(e) => setNewEmployee((p) => ({ ...p, email: e.target.value }))}
                    placeholder="employee@gmail.com"
                    disabled={busy}
                    style={{ paddingLeft: '40px', borderRadius: '12px', height: '48px', border: '1.5px solid var(--border)' }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div style={{
            marginTop: '2.5rem',
            padding: '1.25rem',
            background: 'var(--bg)',
            borderRadius: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1.5rem',
            border: '1px dashed var(--border)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ background: 'white', padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                <Lock size={20} color="var(--primary)" />
              </div>
              <div>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-light)', fontWeight: 500 }}>Initial Password</p>
                <p style={{ margin: 0, fontSize: '1rem', color: 'var(--text)', fontWeight: 700 }}>savan@123</p>
              </div>
            </div>

            <button
              onClick={createEmployeeFromDashboard}
              disabled={busy || !newEmployee.firstName || !newEmployee.email || newEmployee.phone.length !== 10}
              className="btn btn-primary"
              style={{
                height: '52px',
                padding: '0 2.5rem',
                borderRadius: '14px',
                fontSize: '1rem',
                fontWeight: '700',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                boxShadow: '0 10px 20px rgba(22, 163, 74, 0.2), 0 5px 10px rgba(22, 163, 74, 0.1)',
                transition: 'all 0.2s ease',
                cursor: (busy || !newEmployee.firstName || !newEmployee.email || newEmployee.phone.length !== 10) ? 'not-allowed' : 'pointer'
              }}
            >
              {busy ? <div className="spinner spinner-white" /> : <UserCheck size={20} />}
              Add New Employee
            </button>
          </div>
        </div>

        <div className="card" style={{ marginTop: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
            <div style={{ background: 'var(--primary-soft)', color: 'var(--primary)', padding: '0.75rem', borderRadius: '12px' }}>
              <Users size={20} />
            </div>
            <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '700' }}>Active Employees</h3>
          </div>

          <div className="table-scroll-wrapper">
            <table>
              <thead>
                <tr>
                  <th className="sticky-col">Employee ID</th>
                  <th>Full Name</th>
                  <th>Contact Number</th>
                  <th>Official Email</th>
                  <th style={{ textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {employeesData.map(e => (
                  <tr key={e._id}>
                    <td className="sticky-col" style={{ fontWeight: '700', color: 'var(--primary)' }}>{e.empId}</td>
                    <td style={{ fontWeight: '600' }}>{`${e.firstName} ${e.lastName || ''} ${e.surname || ''}`.trim()}</td>
                    <td>{e.phone}</td>
                    <td>{e.email}</td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        onClick={() => {
                          setEditingEmployee({ ...e });
                          setShowEditModal(true);
                        }}
                        className="btn btn-secondary"
                        style={{ padding: '0.4rem', borderRadius: '8px' }}
                        title="Edit Profile"
                      >
                        <Edit size={16} color="var(--primary)" />
                      </button>
                    </td>
                  </tr>
                ))}
                {employeesData.length === 0 && !busy && (
                  <tr><td colSpan={5} className="empty-state">No employees found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Edit Employee Modal */}
      {showEditModal && editingEmployee && (
        <div
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setShowEditModal(false)}
        >
          <div
            className="card"
            style={{
              width: '500px',
              maxWidth: '95%',
              padding: '2rem',
              borderRadius: '24px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '800', color: 'var(--text)' }}>Edit Employee Profile</h3>
              <div style={{ background: 'var(--primary-soft)', color: 'var(--primary)', padding: '0.5rem', borderRadius: '10px', fontSize: '0.9rem', fontWeight: '700' }}>
                {editingEmployee.empId}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={{ display: 'flex', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-light)', alignItems: 'center', gap: '0.4rem' }}>
                  <ShieldCheck size={14} /> Official Employee ID
                </label>
                <input
                  className="input"
                  value={editingEmployee.empId}
                  disabled
                  style={{
                    borderRadius: '12px',
                    fontWeight: '700',
                    background: 'var(--bg)',
                    border: '1.5px solid var(--border)',
                    color: 'var(--text-light)',
                    cursor: 'not-allowed'
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.25rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-light)' }}>First Name</label>
                  <input
                    className="input"
                    value={editingEmployee.firstName}
                    onChange={(e) => setEditingEmployee(p => ({ ...p, firstName: e.target.value }))}
                    style={{ borderRadius: '12px' }}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-light)' }}>Last Name</label>
                    <input
                      className="input"
                      value={editingEmployee.lastName || ''}
                      onChange={(e) => setEditingEmployee(p => ({ ...p, lastName: e.target.value }))}
                      style={{ borderRadius: '12px' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-light)' }}>Surname</label>
                    <input
                      className="input"
                      value={editingEmployee.surname || ''}
                      onChange={(e) => setEditingEmployee(p => ({ ...p, surname: e.target.value }))}
                      style={{ borderRadius: '12px' }}
                    />
                  </div>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-light)' }}>Phone Number</label>
                <input
                  className="input"
                  value={editingEmployee.phone || ''}
                  onChange={(e) => setEditingEmployee(p => ({ ...p, phone: e.target.value.replace(/\D/g, '').slice(0, 10) }))}
                  style={{ borderRadius: '12px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-light)' }}>Email Address</label>
                <input
                  className="input"
                  type="email"
                  value={editingEmployee.email || ''}
                  onChange={(e) => setEditingEmployee(p => ({ ...p, email: e.target.value }))}
                  style={{ borderRadius: '12px' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '2.5rem' }}>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingEmployee(null);
                }}
                className="btn btn-secondary"
                style={{ flex: 1, height: '48px', borderRadius: '12px', fontWeight: '600' }}
              >
                Cancel
              </button>
              <button
                onClick={updateEmployee}
                disabled={busy || !editingEmployee.firstName || !editingEmployee.email || (editingEmployee.phone && editingEmployee.phone.length !== 10)}
                className="btn btn-primary"
                style={{ flex: 2, height: '48px', borderRadius: '12px', fontWeight: '700' }}
              >
                {busy ? <div className="spinner spinner-white" /> : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
