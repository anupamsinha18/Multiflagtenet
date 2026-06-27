import React, { useState, useEffect } from 'react';

const API_URL = 'http://localhost:5001/api';

function App() {
  const [isSignup, setIsSignup] = useState(false);
  const [token, setToken] = useState(localStorage.getItem('admin_token') || '');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [orgId, setOrgId] = useState('');
  const [orgName, setOrgName] = useState('');
  const [adminUser, setAdminUser] = useState(localStorage.getItem('admin_username') || '');

  // Dynamic dropdown organizations for signup
  const [organizations, setOrganizations] = useState([]);

  // Dashboard content
  const [flags, setFlags] = useState([]);
  const [users, setUsers] = useState([]);

  // New item creation states
  const [newFlagKey, setNewFlagKey] = useState('');
  const [newFlagEnabled, setNewFlagEnabled] = useState(false);
  const [newFlagDesc, setNewFlagDesc] = useState('');

  const [newUserUser, setNewUserUser] = useState('');
  const [newUserPass, setNewUserPass] = useState('');

  // UI feedback states
  const [authError, setAuthError] = useState('');
  const [authSuccess, setAuthSuccess] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  // Fetch organizations list on load / toggle to signup
  useEffect(() => {
    if (isSignup || !token) {
      loadOrganizations();
    }
  }, [isSignup, token]);

  // Fetch dashboard data if authenticated
  useEffect(() => {
    if (token) {
      const storedOrgName = localStorage.getItem('admin_org_name');
      if (storedOrgName) setOrgName(storedOrgName);
      fetchFlags();
      fetchUsers();
    }
  }, [token]);

  const loadOrganizations = async () => {
    try {
      const res = await fetch(`${API_URL}/organizations`);
      const data = await res.json();
      if (res.ok) {
        setOrganizations(data);
        if (data.length > 0 && !orgId) {
          setOrgId(data[0].id.toString());
        }
      }
    } catch (err) {
      console.error('Failed to load organizations:', err);
    }
  };

  const handleSignupSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccess('');
    setLoading(true);

    if (!orgId) {
      setAuthError('Please select or create an organization first.');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`${API_URL}/admin/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          password,
          organization_id: parseInt(orgId)
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Signup failed');
      }

      setAuthSuccess('Administrator registered successfully! Please log in.');
      setIsSignup(false);
      setUsername('');
      setPassword('');
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccess('');
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Login failed');
      }

      localStorage.setItem('admin_token', data.token);
      localStorage.setItem('admin_username', data.username);
      localStorage.setItem('admin_org_name', data.organization_name);
      localStorage.setItem('admin_org_id', data.organization_id);

      setToken(data.token);
      setAdminUser(data.username);
      setOrgName(data.organization_name);
      setUsername('');
      setPassword('');
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_username');
    localStorage.removeItem('admin_org_name');
    localStorage.removeItem('admin_org_id');

    setToken('');
    setAdminUser('');
    setOrgName('');
    setFlags([]);
    setUsers([]);
    setActionError('');
    setActionSuccess('');
  };

  const fetchFlags = async () => {
    try {
      const res = await fetch(`${API_URL}/admin/flags`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setFlags(data);
      } else {
        throw new Error(data.error || 'Failed to fetch flags');
      }
    } catch (err) {
      setActionError(err.message);
      if (err.message.includes('expired') || err.message.includes('token')) {
        handleLogout();
      }
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch(`${API_URL}/admin/users`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setUsers(data);
      }
    } catch (err) {
      console.error('Failed to load users:', err);
    }
  };

  const handleCreateFlag = async (e) => {
    e.preventDefault();
    setActionError('');
    setActionSuccess('');

    if (!newFlagKey.trim()) {
      setActionError('Feature key is required');
      return;
    }

    try {
      const res = await fetch(`${API_URL}/admin/flags`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          feature_key: newFlagKey.trim(),
          is_enabled: newFlagEnabled,
          description: newFlagDesc.trim()
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create feature flag');
      }

      setActionSuccess(`Feature flag '${data.feature_key}' created successfully.`);
      setNewFlagKey('');
      setNewFlagEnabled(false);
      setNewFlagDesc('');
      fetchFlags();
    } catch (err) {
      setActionError(err.message);
    }
  };

  const handleToggleFlag = async (flagId, currentStatus, flagDescription) => {
    setActionError('');
    setActionSuccess('');

    try {
      const res = await fetch(`${API_URL}/admin/flags/${flagId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          is_enabled: !currentStatus,
          description: flagDescription
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to toggle flag');
      }

      // Optimistically/Directly update state
      setFlags(flags.map(f => f.id === parseInt(flagId) ? { ...f, is_enabled: !currentStatus } : f));
      setActionSuccess(`Feature status updated.`);
    } catch (err) {
      setActionError(err.message);
    }
  };

  const handleDeleteFlag = async (flagId) => {
    if (!window.confirm('Are you sure you want to delete this feature flag?')) return;

    setActionError('');
    setActionSuccess('');

    try {
      const res = await fetch(`${API_URL}/admin/flags/${flagId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete flag');
      }

      setActionSuccess('Feature flag deleted.');
      fetchFlags();
    } catch (err) {
      setActionError(err.message);
    }
  };

  const handleCreateEndUser = async (e) => {
    e.preventDefault();
    setActionError('');
    setActionSuccess('');

    if (!newUserUser.trim() || !newUserPass.trim()) {
      setActionError('Username and password are required for End Users');
      return;
    }

    try {
      const res = await fetch(`${API_URL}/admin/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          username: newUserUser.trim(),
          password: newUserPass.trim()
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create end user');
      }

      setActionSuccess(`End user '${data.username}' created successfully.`);
      setNewUserUser('');
      setNewUserPass('');
      fetchUsers();
    } catch (err) {
      setActionError(err.message);
    }
  };

  if (!token) {
    return (
      <div className="auth-wrapper">
        <div className="glass-card">
          <div className="text-center">
            <span className="logo">🛡️ FlagPort <span className="logo-badge">Tenant Admin</span></span>
          </div>

          <h2 className="card-title mt-4">{isSignup ? 'Create Admin Account' : 'Admin Login'}</h2>
          <p className="card-subtitle">
            {isSignup 
              ? 'Register as administrator under a registered organization' 
              : 'Sign in to manage feature flags for your organization'}
          </p>

          {authError && (
            <div className="alert alert-error">
              <span>⚠️</span> {authError}
            </div>
          )}

          {authSuccess && (
            <div className="alert alert-success">
              <span>✅</span> {authSuccess}
            </div>
          )}

          <form onSubmit={isSignup ? handleSignupSubmit : handleLoginSubmit}>
            {isSignup && (
              <div className="form-group">
                <label htmlFor="orgSelect">Select Organization</label>
                {organizations.length === 0 ? (
                  <p style={{ color: 'var(--error-color)', fontSize: '0.85rem' }}>
                    No organizations available. Contact Super Admin to register your company.
                  </p>
                ) : (
                  <select
                    id="orgSelect"
                    className="form-select"
                    value={orgId}
                    onChange={(e) => setOrgId(e.target.value)}
                    required
                  >
                    {organizations.map((org) => (
                      <option key={org.id} value={org.id}>
                        {org.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            <div className="form-group">
              <label htmlFor="username">Username</label>
              <input
                id="username"
                type="text"
                className="form-input"
                placeholder="e.g., admin_user"
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
              {loading 
                ? 'Processing...' 
                : isSignup ? 'Create Account' : 'Sign In'}
            </button>
          </form>

          <div className="text-center mt-4">
            <button 
              onClick={() => {
                setIsSignup(!isSignup);
                setAuthError('');
                setAuthSuccess('');
              }} 
              className="link-btn"
            >
              {isSignup ? 'Already have an account? Sign In' : 'Need an account? Sign Up'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <header>
        <span className="logo">🛡️ FlagPort <span className="logo-badge">Tenant Admin</span></span>
        <div className="user-info">
          <span className="user-tag">Admin: <strong>{adminUser}</strong></span>
          <span className="user-tag" style={{ backgroundColor: 'rgba(99, 102, 241, 0.15)', borderColor: 'rgba(99, 102, 241, 0.3)', color: '#a5b4fc' }}>
            Tenant: <strong>{orgName}</strong>
          </span>
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
          {/* Feature Flags Workspace */}
          <div className="glass-card glass-card-wide" style={{ width: '100%', maxWidth: '100%' }}>
            <h3 className="section-title">Feature Flags Control Desk</h3>
            
            {flags.length === 0 ? (
              <div className="empty-state">
                <p>No feature flags defined yet. Create your first flag using the control console.</p>
              </div>
            ) : (
              <div className="table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Feature Key</th>
                      <th>Description</th>
                      <th style={{ textAlign: 'center' }}>Status</th>
                      <th style={{ textAlign: 'center' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {flags.map((flag) => (
                      <tr key={flag.id}>
                        <td><code>{flag.feature_key}</code></td>
                        <td><span style={{ color: 'var(--text-secondary)' }}>{flag.description || 'No description provided.'}</span></td>
                        <td style={{ textAlign: 'center' }}>
                          <label className="switch">
                            <input
                              type="checkbox"
                              checked={flag.is_enabled}
                              onChange={() => handleToggleFlag(flag.id, flag.is_enabled, flag.description)}
                            />
                            <span className="slider"></span>
                          </label>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            onClick={() => handleDeleteFlag(flag.id)}
                            className="btn btn-danger btn-sm"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Creation Sidebar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', width: '100%' }}>
            {/* Create Flag Form */}
            <div className="glass-card" style={{ width: '100%', padding: '2rem' }}>
              <h3 className="section-title">New Feature Flag</h3>
              <form onSubmit={handleCreateFlag}>
                <div className="form-group">
                  <label htmlFor="flagKey">Feature Key</label>
                  <input
                    id="flagKey"
                    type="text"
                    className="form-input"
                    placeholder="e.g., enable_dark_mode"
                    value={newFlagKey}
                    onChange={(e) => setNewFlagKey(e.target.value)}
                    required
                  />
                  <small style={{ color: 'var(--text-secondary)', display: 'block', marginTop: '0.25rem', fontSize: '0.75rem' }}>
                    Alpha-numeric keys only (spaces/dashes will become underscores).
                  </small>
                </div>

                <div className="form-group">
                  <label htmlFor="flagDesc">Description</label>
                  <input
                    id="flagDesc"
                    type="text"
                    className="form-input"
                    placeholder="Describe this flag's purpose"
                    value={newFlagDesc}
                    onChange={(e) => setNewFlagDesc(e.target.value)}
                  />
                </div>

                <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '1rem', marginBottom: '1.5rem' }}>
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={newFlagEnabled}
                      onChange={(e) => setNewFlagEnabled(e.target.checked)}
                    />
                    <span className="slider"></span>
                  </label>
                  <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>
                    Enable by default
                  </span>
                </div>

                <button type="submit" className="btn btn-primary btn-full">
                  Deploy Flag
                </button>
              </form>
            </div>

            {/* Manage End Users Form */}
            <div className="glass-card" style={{ width: '100%', padding: '2rem' }}>
              <h3 className="section-title">Create End-User Credentials</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
                Provision client credentials. Users will use these credentials on the User portal to query features.
              </p>

              <form onSubmit={handleCreateEndUser} style={{ marginBottom: '1.5rem' }}>
                <div className="form-group">
                  <label htmlFor="newUserUser">User Username</label>
                  <input
                    id="newUserUser"
                    type="text"
                    className="form-input"
                    placeholder="e.g., test_employee"
                    value={newUserUser}
                    onChange={(e) => setNewUserUser(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="newUserPass">User Password</label>
                  <input
                    id="newUserPass"
                    type="password"
                    className="form-input"
                    placeholder="••••••••"
                    value={newUserPass}
                    onChange={(e) => setNewUserPass(e.target.value)}
                    required
                  />
                </div>

                <button type="submit" className="btn btn-secondary btn-full">
                  Create User
                </button>
              </form>

              {users.length > 0 && (
                <div>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>
                    Existing Users ({users.length})
                  </h4>
                  <div style={{ maxHeight: '150px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '0.5rem' }}>
                    {users.map(u => (
                      <div key={u.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.25rem 0.5rem', fontSize: '0.85rem', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                        <strong>{u.username}</strong>
                        <span style={{ color: 'var(--text-secondary)' }}>End User</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      <footer className="footer">
        <p>&copy; {new Date().getFullYear()} FlagPort Multi-Tenant Systems. Designed for organization administrators.</p>
      </footer>
    </div>
  );
}

export default App;
