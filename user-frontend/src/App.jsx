import React, { useState } from 'react';

const API_URL = 'http://localhost:5001/api';

function App() {
  const [token, setToken] = useState(localStorage.getItem('user_token') || '');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [orgName, setOrgName] = useState(localStorage.getItem('user_org_name') || '');
  const [userDisplayName, setUserDisplayName] = useState(localStorage.getItem('user_display_name') || '');

  // Checking feature states
  const [featureKey, setFeatureKey] = useState('');
  const [checkResult, setCheckResult] = useState(null); // { enabled: boolean, exists: boolean, key: string }
  
  // UI states
  const [authError, setAuthError] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkLoading, setCheckLoading] = useState(false);
  const [checkError, setCheckError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError('');
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/user/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Login failed');
      }

      localStorage.setItem('user_token', data.token);
      localStorage.setItem('user_org_name', data.organization_name);
      localStorage.setItem('user_display_name', data.username);

      setToken(data.token);
      setOrgName(data.organization_name);
      setUserDisplayName(data.username);
      setUsername('');
      setPassword('');
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('user_token');
    localStorage.removeItem('user_org_name');
    localStorage.removeItem('user_display_name');

    setToken('');
    setOrgName('');
    setUserDisplayName('');
    setFeatureKey('');
    setCheckResult(null);
    setCheckError('');
  };

  const handleCheckFeature = async (e) => {
    e.preventDefault();
    setCheckError('');
    setCheckResult(null);

    const cleanKey = featureKey.trim().toLowerCase();
    if (!cleanKey) {
      setCheckError('Please enter a feature key to verify.');
      return;
    }

    setCheckLoading(true);

    try {
      const res = await fetch(`${API_URL}/user/check?key=${cleanKey}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to check flag status');
      }

      setCheckResult({
        key: cleanKey,
        enabled: data.enabled,
        exists: data.exists
      });
    } catch (err) {
      setCheckError(err.message);
      if (err.message.includes('expired') || err.message.includes('token')) {
        handleLogout();
      }
    } finally {
      setCheckLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="auth-wrapper">
        <div className="glass-card">
          <div className="text-center">
            <span className="logo">🛡️ FlagPort <span className="logo-badge">End User</span></span>
          </div>

          <h2 className="card-title mt-4">Client Access Portal</h2>
          <p className="card-subtitle">
            Log in with the credentials provided by your Administrator
          </p>

          {authError && (
            <div className="alert alert-error">
              <span>⚠️</span> {authError}
            </div>
          )}

          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label htmlFor="username">Username</label>
              <input
                id="username"
                type="text"
                className="form-input"
                placeholder="e.g., john_doe"
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
        <span className="logo">🛡️ FlagPort <span className="logo-badge">Client Portal</span></span>
        <div className="user-info">
          <span className="user-tag">User: <strong>{userDisplayName}</strong></span>
          <span className="user-tag" style={{ backgroundColor: 'rgba(99, 102, 241, 0.15)', borderColor: 'rgba(99, 102, 241, 0.3)', color: '#a5b4fc' }}>
            Organization: <strong>{orgName}</strong>
          </span>
          <button onClick={handleLogout} className="btn btn-secondary btn-sm">
            Sign Out
          </button>
        </div>
      </header>

      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="glass-card user-check-card">
          <h2 className="card-title" style={{ textAlign: 'left', marginBottom: '0.25rem' }}>Feature Tester</h2>
          <p className="card-subtitle" style={{ textAlign: 'left', marginBottom: '1.5rem' }}>
            Enter a feature flag key below to verify its status for your organization.
          </p>

          <form onSubmit={handleCheckFeature}>
            <div className="form-group" style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <input
                type="text"
                className="form-input"
                placeholder="e.g., enable_beta_dashboard"
                value={featureKey}
                onChange={(e) => setFeatureKey(e.target.value)}
                style={{ flex: 1 }}
                required
              />
              <button type="submit" className="btn btn-primary" disabled={checkLoading}>
                {checkLoading ? 'Checking...' : 'Check Status'}
              </button>
            </div>
          </form>

          {checkError && (
            <div className="alert alert-error" style={{ marginTop: '1rem' }}>
              <span>⚠️</span> {checkError}
            </div>
          )}

          {checkResult && (
            <div className={`result-container ${checkResult.exists && checkResult.enabled ? 'result-active' : 'result-inactive'}`}>
              <div className="result-title">
                Status of <code>{checkResult.key}</code>
              </div>
              
              {!checkResult.exists ? (
                <div>
                  <div className="result-status" style={{ color: 'var(--text-secondary)' }}>UNDEFINED</div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                    This feature key does not exist or has not been scoped for <strong>{orgName}</strong>.
                  </p>
                </div>
              ) : checkResult.enabled ? (
                <div>
                  <div className="result-status">ACTIVE</div>
                  <p style={{ fontSize: '0.85rem', color: '#6ee7b7', marginTop: '0.5rem' }}>
                    Feature flag is currently enabled for your tenant workspace.
                  </p>
                </div>
              ) : (
                <div>
                  <div className="result-status">DISABLED</div>
                  <p style={{ fontSize: '0.85rem', color: '#fca5a5', marginTop: '0.5rem' }}>
                    Feature flag is registered, but currently turned off for your organization.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      <footer className="footer">
        <p>&copy; {new Date().getFullYear()} FlagPort Multi-Tenant Systems. Scoped for secure client workspaces.</p>
      </footer>
    </div>
  );
}

export default App;
