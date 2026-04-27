import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { X, User, Phone, Mail, Save, Loader2 } from 'lucide-react';

export default function ProfileModal({ isOpen, onClose, user, onUpdate }) {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    surname: '',
    phone: '',
    email: ''
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!isOpen || !user?.employeeId) return;
    let cancelled = false;

    const fetchProfile = async () => {
      setLoading(true);
      setError(null);
      try {
        const isEmployee = user?.role && String(user.role).toLowerCase() === 'employee';
        const endpoint = isEmployee
          ? '/api/employees/profile/me'
          : `/api/employees/${user?.id || user?.employeeId || user?.sub}`;
        const res = await api.get(endpoint);
        const emp = res.data.employee;
        if (cancelled) return;
        setFormData({
          firstName: emp.firstName || '',
          lastName: emp.lastName || '',
          surname: emp.surname || '',
          phone: emp.phone || '',
          email: emp.email || ''
        });
      } catch (err) {
        if (cancelled) return;
        setError('Failed to load profile details');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchProfile();
    return () => {
      cancelled = true;
    };
  }, [
    isOpen,
    user?.employeeId,
    user?.id,
    user?.sub,
    user?.role,
  ]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const isEmployee = user?.role && String(user.role).toLowerCase() === 'employee';
      const endpoint = isEmployee ? '/api/employees/profile/me' : `/api/employees/${user?.id || user?.employeeId || user?.sub}`;
      await api.patch(endpoint, formData);
      setSuccess(true);
      if (onUpdate) onUpdate();
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 1500);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ width: '500px' }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--primary-soft)' }}>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--primary)' }}>
            <User size={20} />
            Edit Profile
          </h3>
          <button className="btn-icon" onClick={onClose} style={{ color: 'var(--primary)' }}><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '2rem' }}>
          {error && <div className="alert alert-error" style={{ marginBottom: '1.5rem' }}>{error}</div>}
          {success && <div className="alert alert-success" style={{ marginBottom: '1.5rem' }}>Profile updated successfully!</div>}

          {loading ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-light)' }}>
              <Loader2 className="spin" style={{ margin: '0 auto 1rem' }} />
              <p>Loading profile...</p>
            </div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.5rem' }}>
                <div>
                  <label className="label">First Name</label>
                  <input 
                    type="text" className="input" required
                    value={formData.firstName}
                    onChange={e => setFormData({ ...formData, firstName: e.target.value })}
                    placeholder="First Name"
                  />
                </div>
                <div>
                  <label className="label">Last Name</label>
                  <input 
                    type="text" className="input"
                    value={formData.lastName}
                    onChange={e => setFormData({ ...formData, lastName: e.target.value })}
                    placeholder="Last Name"
                  />
                </div>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label className="label">Surname</label>
                <input 
                  type="text" className="input"
                  value={formData.surname}
                  onChange={e => setFormData({ ...formData, surname: e.target.value })}
                  placeholder="Surname"
                />
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label className="label">Phone Number</label>
                <div style={{ position: 'relative' }}>
                  <Phone size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }} />
                  <input 
                    type="tel" className="input" style={{ paddingLeft: '2.75rem' }}
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="10 digit phone number"
                  />
                </div>
              </div>

              <div style={{ marginBottom: '2rem' }}>
                <label className="label">Email Address</label>
                <div style={{ position: 'relative' }}>
                  <Mail size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }} />
                  <input 
                    type="email" className="input" style={{ paddingLeft: '2.75rem' }}
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    placeholder="example@gmail.com"
                  />
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-light)', marginTop: '0.6rem', lineHeight: 1.4 }}>
                   🔒 Changing your email will also update your login username for the next session.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={onClose} disabled={saving}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 2 }} disabled={saving}>
                  {saving ? <><Loader2 size={18} className="spin" /> Saving...</> : <><Save size={18} /> Save Changes</>}
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
