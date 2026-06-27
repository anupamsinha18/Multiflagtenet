import React, { useState, useEffect } from 'react';

const API_URL = 'http://localhost:5001/api';

function App() {
  const [token, setToken] = useState(localStorage.getItem('super_admin_token') || '');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [organizations, setOrganizations] = useState([]);
  const [newOrgName, setNewOrgName] = useState('');
  
  // Status states
  const [loginError, setLoginError] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (token) {
      fetchOrganizations();
    }
  }, [token]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/super-admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      localStorage.setItem('super_admin_token', data.token);
      setToken(data.token);
      setUsername('');
      setPassword('');
    } catch (err) {
      setLoginError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('super_admin_token');
    setToken('');
    setOrganizations([]);
    setActionSuccess('');
    setActionError('');
  };

  const fetchOrganizations = async () => {
    try {
      const response = await fetch(`${API_URL}/super-admin/organizations`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch organizations');
      }
      setOrganizations(data);
    } catch (err) {
      setActionError(err.message);
      if (response && response.status === 430) {
        handleLogout();
      }
    }
  };

  const handleCreateOrg = async (e) => {
    e.preventDefault();
    setActionError('');
    setActionSuccess('');

    if (!newOrgName.trim()) {
      setActionError('Organization name cannot be empty');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/super-admin/organizations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: newOrgName.trim() })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create organization');
      }

      setActionSuccess(`Organization "${data.name}" created successfully!`);
      setNewOrgName('');
      fetchOrganizations();
    } catch (err) {
      setActionError(err.message);
    }
  };

  if (!token) {
    return (
      <div className="auth-wrapper">
        <div className="glass-card">
          <div className="text-center">
            <span className="logo">🛡️ FlagPort <span className="logo-badge">Super Admin</span></span>
          </div>
          <h2 className="card-title mt-4">Welcome Back</h2>
          <p className="card-subtitle">Sign in using your static system credentials</p>

          {loginError && (
            <div className="alert alert-error">
              <span>⚠️</span> {loginError}
            </div>
          )}

          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label htmlFor="username">Username</label>
              <input
                id="username"
                type="text"
                className="form-input"
                placeholder="e.g., superadmin"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                className="form-input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
              {loading ? 'Authenticating...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <header>
        <span className="logo">🛡️ FlagPort <span className="logo-badge">Super Admin</span></span>
        <div className="user-info">
          <span className="user-tag">Role: <strong>Super Admin</strong></span>
          <button onClick={handleLogout} className="btn btn-secondary btn-sm">
            Sign Out
          </button>
        </div>
      </header>

      <main>
        {actionError && (
          <div className="alert alert-error">
            <span>⚠️</span> {actionError}
          </div>
        )}
        {actionSuccess && (
          <div className="alert alert-success">
            <span>✅</span> {actionSuccess}
          </div>
        )}

        <div className="dashboard-grid">
          {/* Organizations List */}
          <div className="glass-card glass-card-wide" style={{ width: '100%', maxWidth: '100%' }}>
            <h3 className="section-title">Organizations Directory</h3>
            
            {organizations.length === 0 ? (
              <div className="empty-state">
                <p>No organizations registered yet. Use the creation panel to add one.</p>
              </div>
            ) : (
              <div className="table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Organization Name</th>
                      <th>Created At</th>
                      <th style={{ textAlign: 'center' }}>Total Admins/Users</th>
                      <th style={{ textAlign: 'center' }}>Total Flags</th>
                    </tr>
                  </thead>
                  <tbody>
                    {organizations.map((org) => (
                      <tr key={org.id}>
                        <td><code>#{org.id}</code></td>
                        <td><strong>{org.name}</strong></td>
                        <td>{new Date(org.created_at).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}</td>
                        <td style={{ textAlign: 'center' }}>
                          <span className="badge badge-success">
                            {org.user_count}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span className="badge badge-success" style={{ backgroundColor: 'rgba(99, 102, 241, 0.15)', color: '#a5b4fc', borderColor: 'rgba(99, 102, 241, 0.3)' }}>
                            {org.flag_count}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Creation Panel */}
          <div className="glass-card" style={{ width: '100%', maxWidth: '100%' }}>
            <h3 className="section-title">Register New Tenant</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
              Create an organization below. Once created, organization admins will be able to sign up under this tenant.
            </p>

            <form onSubmit={handleCreateOrg}>
              <div className="form-group">
                <label htmlFor="newOrgName">Organization Name</label>
                <input
                  id="newOrgName"
                  type="text"
                  className="form-input"
                  placeholder="e.g., Acme Corporation"
                  value={newOrgName}
                  onChange={(e) => setNewOrgName(e.target.value)}
                  required
                />
              </div>

              <button type="submit" className="btn btn-primary btn-full">
                Create Tenant
              </button>
            </form>
          </div>
        </div>
      </main>

      <footer className="footer">
        <p>&copy; {new Date().getFullYear()} FlagPort Multi-Tenant Systems. Designed for Super Admin operations.</p>
      </footer>
    </div>
  );
}

export default App;
