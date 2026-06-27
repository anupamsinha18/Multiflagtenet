const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 5001;

// Secret keys & static credentials
const JWT_SECRET = process.env.JWT_SECRET || 'multi_tenant_secret_key_987654';
const SUPER_ADMIN_USER = 'superadmin';
const SUPER_ADMIN_PASS = 'superadminpassword'; // Hardcoded/config-based static credentials

app.use(cors());
app.use(express.json());

// Initialize database tables
db.initDb();

// Middleware: Authenticate JWT Token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// Middleware: Role-Based Authorization
const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied: insufficient permissions' });
    }
    next();
  };
};

// ==========================================
// 1. PUBLIC / GENERAL ROUTES
// ==========================================

// Get list of organizations (useful for registration dropdowns)
app.get('/api/organizations', async (req, res) => {
  try {
    const orgs = await db.all('SELECT id, name, created_at FROM organizations ORDER BY name ASC');
    res.json(orgs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch organizations' });
  }
});

// Optional public check (unauthenticated)
app.get('/api/public/check', async (req, res) => {
  const { org_id, key } = req.query;
  if (!org_id || !key) {
    return res.status(400).json({ error: 'Missing org_id or key parameter' });
  }

  try {
    const flag = await db.get(
      'SELECT is_enabled FROM feature_flags WHERE organization_id = ? AND feature_key = ?',
      [org_id, key]
    );

    if (!flag) {
      return res.json({ enabled: false, exists: false });
    }

    res.json({ enabled: flag.is_enabled === 1, exists: true });
  } catch (error) {
    res.status(500).json({ error: 'Error checking feature flag' });
  }
});

// ==========================================
// 2. SUPER ADMIN ROUTES
// ==========================================

// Super admin login
app.post('/api/super-admin/login', (req, res) => {
  const { username, password } = req.body;

  if (username === SUPER_ADMIN_USER && password === SUPER_ADMIN_PASS) {
    const token = jwt.sign(
      { username, role: 'super_admin' },
      JWT_SECRET,
      { expiresIn: '2h' }
    );
    return res.json({ token, role: 'super_admin' });
  }

  res.status(401).json({ error: 'Invalid super-admin credentials' });
});

// Create organization
app.post('/api/super-admin/organizations', authenticateToken, requireRole(['super_admin']), async (req, res) => {
  const { name } = req.body;
  if (!name || name.trim() === '') {
    return res.status(400).json({ error: 'Organization name is required' });
  }

  try {
    const result = await db.run('INSERT INTO organizations (name) VALUES (?)', [name.trim()]);
    res.status(201).json({ id: result.id, name: name.trim() });
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: 'Organization name already exists' });
    }
    res.status(500).json({ error: 'Failed to create organization' });
  }
});

// View list of organizations (with detail counts)
app.get('/api/super-admin/organizations', authenticateToken, requireRole(['super_admin']), async (req, res) => {
  try {
    const orgs = await db.all(`
      SELECT 
        o.id, 
        o.name, 
        o.created_at,
        COUNT(distinct u.id) as user_count,
        COUNT(distinct f.id) as flag_count
      FROM organizations o
      LEFT JOIN users u ON o.id = u.organization_id
      LEFT JOIN feature_flags f ON o.id = f.organization_id
      GROUP BY o.id
      ORDER BY o.name ASC
    `);
    res.json(orgs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch organizations with stats' });
  }
});

// ==========================================
// 3. ORGANIZATION ADMIN ROUTES
// ==========================================

// Organization admin sign up
app.post('/api/admin/signup', async (req, res) => {
  const { username, password, organization_id } = req.body;

  if (!username || !password || !organization_id) {
    return res.status(400).json({ error: 'Username, password, and organization_id are required' });
  }

  try {
    // Verify organization exists
    const org = await db.get('SELECT id FROM organizations WHERE id = ?', [organization_id]);
    if (!org) {
      return res.status(400).json({ error: 'Selected organization does not exist' });
    }

    // Get role ID for org_admin
    const role = await db.get('SELECT id FROM roles WHERE name = ?', ['org_admin']);
    if (!role) {
      return res.status(500).json({ error: 'Admin role not initialized in database' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await db.run(
      'INSERT INTO users (username, password_hash, organization_id, role_id) VALUES (?, ?, ?, ?)',
      [username, passwordHash, organization_id, role.id]
    );

    res.status(201).json({ id: result.id, username, organization_id });
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: 'Username is already taken' });
    }
    res.status(500).json({ error: 'Sign up failed' });
  }
});

// Organization admin login
app.post('/api/admin/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    const user = await db.get(
      `SELECT u.*, r.name as role_name, o.name as org_name
       FROM users u
       JOIN roles r ON u.role_id = r.id
       JOIN organizations o ON u.organization_id = o.id
       WHERE u.username = ? AND r.name = 'org_admin'`,
      [username]
    );

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Invalid admin username or password' });
    }

    const token = jwt.sign(
      { 
        id: user.id, 
        username: user.username, 
        role: 'org_admin', 
        organization_id: user.organization_id,
        organization_name: user.org_name
      },
      JWT_SECRET,
      { expiresIn: '2h' }
    );

    res.json({ token, role: 'org_admin', username: user.username, organization_id: user.organization_id, organization_name: user.org_name });
  } catch (error) {
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get all feature flags for the organization
app.get('/api/admin/flags', authenticateToken, requireRole(['org_admin']), async (req, res) => {
  const orgId = req.user.organization_id;

  try {
    const flags = await db.all(
      'SELECT id, feature_key, is_enabled, description, created_at, updated_at FROM feature_flags WHERE organization_id = ? ORDER BY feature_key ASC',
      [orgId]
    );
    // Map is_enabled from database integer 0/1 to boolean
    const flagsMapped = flags.map(f => ({ ...f, is_enabled: f.is_enabled === 1 }));
    res.json(flagsMapped);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch feature flags' });
  }
});

// Create a new feature flag
app.post('/api/admin/flags', authenticateToken, requireRole(['org_admin']), async (req, res) => {
  const orgId = req.user.organization_id;
  const { feature_key, is_enabled, description } = req.body;

  if (!feature_key || feature_key.trim() === '') {
    return res.status(400).json({ error: 'Feature key is required' });
  }

  // Regex to ensure feature key is simple alphanumeric/underscore
  const cleanKey = feature_key.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');

  try {
    const isEnabledVal = is_enabled ? 1 : 0;
    const result = await db.run(
      'INSERT INTO feature_flags (organization_id, feature_key, is_enabled, description) VALUES (?, ?, ?, ?)',
      [orgId, cleanKey, isEnabledVal, description || '']
    );

    res.status(201).json({
      id: result.id,
      feature_key: cleanKey,
      is_enabled: is_enabled === true,
      description
    });
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: `Feature key '${cleanKey}' already exists in your organization` });
    }
    res.status(500).json({ error: 'Failed to create feature flag' });
  }
});

// Update/Toggle a feature flag
app.put('/api/admin/flags/:id', authenticateToken, requireRole(['org_admin']), async (req, res) => {
  const orgId = req.user.organization_id;
  const flagId = req.params.id;
  const { is_enabled, description } = req.body;

  try {
    // Ensure the flag exists and belongs to the admin's organization
    const flag = await db.get('SELECT id FROM feature_flags WHERE id = ? AND organization_id = ?', [flagId, orgId]);
    if (!flag) {
      return res.status(404).json({ error: 'Feature flag not found' });
    }

    const isEnabledVal = is_enabled ? 1 : 0;
    await db.run(
      'UPDATE feature_flags SET is_enabled = ?, description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [isEnabledVal, description || '', flagId]
    );

    res.json({ id: flagId, is_enabled: is_enabled === true, description });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update feature flag' });
  }
});

// Delete a feature flag
app.delete('/api/admin/flags/:id', authenticateToken, requireRole(['org_admin']), async (req, res) => {
  const orgId = req.user.organization_id;
  const flagId = req.params.id;

  try {
    const flag = await db.get('SELECT id FROM feature_flags WHERE id = ? AND organization_id = ?', [flagId, orgId]);
    if (!flag) {
      return res.status(404).json({ error: 'Feature flag not found' });
    }

    await db.run('DELETE FROM feature_flags WHERE id = ?', [flagId]);
    res.json({ success: true, message: 'Feature flag deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete feature flag' });
  }
});

// Get end users for the admin's organization
app.get('/api/admin/users', authenticateToken, requireRole(['org_admin']), async (req, res) => {
  const orgId = req.user.organization_id;

  try {
    const users = await db.all(
      `SELECT u.id, u.username, u.created_at, r.name as role_name
       FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE u.organization_id = ? AND r.name = 'end_user'
       ORDER BY u.username ASC`,
      [orgId]
    );
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch end users' });
  }
});

// Create an end user for the admin's organization
app.post('/api/admin/users', authenticateToken, requireRole(['org_admin']), async (req, res) => {
  const orgId = req.user.organization_id;
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    const userRole = await db.get('SELECT id FROM roles WHERE name = ?', ['end_user']);
    if (!userRole) {
      return res.status(500).json({ error: 'End user role not initialized' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await db.run(
      'INSERT INTO users (username, password_hash, organization_id, role_id) VALUES (?, ?, ?, ?)',
      [username, passwordHash, orgId, userRole.id]
    );

    res.status(201).json({ id: result.id, username, organization_id: orgId });
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: 'Username is already taken' });
    }
    res.status(500).json({ error: 'Failed to create end user' });
  }
});

// ==========================================
// 4. END USER ROUTES
// ==========================================

// End User Login
app.post('/api/user/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    const user = await db.get(
      `SELECT u.*, r.name as role_name, o.name as org_name
       FROM users u
       JOIN roles r ON u.role_id = r.id
       JOIN organizations o ON u.organization_id = o.id
       WHERE u.username = ? AND r.name = 'end_user'`,
      [username]
    );

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const token = jwt.sign(
      { 
        id: user.id, 
        username: user.username, 
        role: 'end_user', 
        organization_id: user.organization_id,
        organization_name: user.org_name
      },
      JWT_SECRET,
      { expiresIn: '2h' }
    );

    res.json({ token, role: 'end_user', username: user.username, organization_id: user.organization_id, organization_name: user.org_name });
  } catch (error) {
    res.status(500).json({ error: 'Login failed' });
  }
});

// Authenticated check if feature is enabled
app.get('/api/user/check', authenticateToken, requireRole(['end_user']), async (req, res) => {
  const orgId = req.user.organization_id;
  const { key } = req.query;

  if (!key) {
    return res.status(400).json({ error: 'Missing key parameter' });
  }

  try {
    const flag = await db.get(
      'SELECT is_enabled FROM feature_flags WHERE organization_id = ? AND feature_key = ?',
      [orgId, key.trim().toLowerCase()]
    );

    if (!flag) {
      return res.json({ enabled: false, exists: false });
    }

    res.json({ enabled: flag.is_enabled === 1, exists: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to verify feature flag status' });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
