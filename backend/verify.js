const PORT = 5001;
const BASE_URL = `http://localhost:${PORT}`;

async function runTests() {
  console.log('--- Starting Backend Verification Tests ---');

  try {
    // 1. Check organizations (should be empty)
    const orgsRes = await fetch(`${BASE_URL}/api/organizations`);
    const initialOrgs = await orgsRes.json();
    console.log('Initial organizations fetched:', initialOrgs.length);

    // 2. Super Admin Login
    console.log('Logging in as Super Admin...');
    const superLoginRes = await fetch(`${BASE_URL}/api/super-admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'superadmin', password: 'superadminpassword' })
    });
    if (!superLoginRes.ok) throw new Error('Super admin login failed');
    const { token: superToken } = await superLoginRes.json();
    console.log('Super Admin logged in successfully.');

    // 3. Create Organizations
    console.log('Creating organizations...');
    const createOrg = async (name) => {
      const res = await fetch(`${BASE_URL}/api/super-admin/organizations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${superToken}`
        },
        body: JSON.stringify({ name })
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(`Failed to create organization ${name}: ${errorData.error}`);
      }
      return await res.json();
    };

    const acmeOrg = await createOrg('ACME Corp');
    const betaOrg = await createOrg('Beta Industries');
    console.log(`Created Organizations: ACME Corp (ID: ${acmeOrg.id}), Beta Industries (ID: ${betaOrg.id})`);

    // Verify organizations count
    const listRes = await fetch(`${BASE_URL}/api/super-admin/organizations`, {
      headers: { 'Authorization': `Bearer ${superToken}` }
    });
    const listedOrgs = await listRes.json();
    console.log(`Total organizations listed: ${listedOrgs.length} (Expected: 2)`);
    if (listedOrgs.length !== 2) throw new Error('Organization list size mismatch');

    // 4. Sign up Org Admins
    console.log('Signing up Org Admins...');
    const signupAdmin = async (username, password, orgId) => {
      const res = await fetch(`${BASE_URL}/api/admin/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, organization_id: orgId })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(`Signup failed for ${username}: ${err.error}`);
      }
      return await res.json();
    };

    await signupAdmin('acme_admin', 'acmepassword', acmeOrg.id);
    await signupAdmin('beta_admin', 'betapassword', betaOrg.id);
    console.log('Org Admins signed up.');

    // 5. Log in Org Admins
    console.log('Logging in Org Admins...');
    const loginAdmin = async (username, password) => {
      const res = await fetch(`${BASE_URL}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      if (!res.ok) throw new Error(`Login failed for ${username}`);
      return await res.json();
    };

    const acmeAdminSession = await loginAdmin('acme_admin', 'acmepassword');
    const betaAdminSession = await loginAdmin('beta_admin', 'betapassword');
    console.log('Org Admins logged in.');

    // 6. Create Feature Flags
    console.log('Creating feature flags for ACME Corp...');
    const createFlag = async (adminSession, key, isEnabled, desc) => {
      const res = await fetch(`${BASE_URL}/api/admin/flags`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminSession.token}`
        },
        body: JSON.stringify({ feature_key: key, is_enabled: isEnabled, description: desc })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(`Flag creation failed: ${err.error}`);
      }
      return await res.json();
    };

    await createFlag(acmeAdminSession, 'enable_beta_dashboard', true, 'Enables beta dashboard');
    await createFlag(acmeAdminSession, 'enable_billing', false, 'Enables billing tab');
    console.log('Created ACME Corp flags: enable_beta_dashboard (ON), enable_billing (OFF)');

    console.log('Creating feature flags for Beta Industries...');
    await createFlag(betaAdminSession, 'enable_beta_dashboard', false, 'Beta dashboard for Beta');
    await createFlag(betaAdminSession, 'enable_advanced_search', true, 'Advanced search for Beta');
    console.log('Created Beta Industries flags: enable_beta_dashboard (OFF), enable_advanced_search (ON)');

    // 7. Create End User for ACME Corp
    console.log('Creating End User for ACME Corp...');
    const createEndUser = async (adminSession, username, password) => {
      const res = await fetch(`${BASE_URL}/api/admin/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminSession.token}`
        },
        body: JSON.stringify({ username, password })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(`Failed to create end user: ${err.error}`);
      }
      return await res.json();
    };

    await createEndUser(acmeAdminSession, 'acme_user_1', 'acmeuserpass');
    console.log('Created End User: acme_user_1');

    // 8. Log in as End User
    console.log('Logging in as End User...');
    const userLoginRes = await fetch(`${BASE_URL}/api/user/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'acme_user_1', password: 'acmeuserpass' })
    });
    if (!userLoginRes.ok) throw new Error('End user login failed');
    const userSession = await userLoginRes.json();
    console.log(`End User logged in. Organization name: ${userSession.organization_name}`);

    // 9. Check flags as End User (should be organization scoped)
    const checkFlag = async (userToken, key) => {
      const res = await fetch(`${BASE_URL}/api/user/check?key=${key}`, {
        headers: { 'Authorization': `Bearer ${userToken}` }
      });
      if (!res.ok) throw new Error(`Flag check failed for ${key}`);
      return await res.json();
    };

    console.log('Verifying feature flag values for ACME Corp user...');
    const check1 = await checkFlag(userSession.token, 'enable_beta_dashboard');
    console.log('enable_beta_dashboard status:', check1);
    if (check1.enabled !== true) throw new Error('ACME Corp flag check failed: expected enable_beta_dashboard = true');

    const check2 = await checkFlag(userSession.token, 'enable_billing');
    console.log('enable_billing status:', check2);
    if (check2.enabled !== false) throw new Error('ACME Corp flag check failed: expected enable_billing = false');

    const check3 = await checkFlag(userSession.token, 'enable_advanced_search');
    console.log('enable_advanced_search status:', check3);
    if (check3.exists !== false) throw new Error('ACME Corp flag check failed: expected enable_advanced_search to not exist');

    console.log('All API tests passed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Test suite failed with error:', error.message);
    process.exit(1);
  }
}

// Small delay to make sure server is running
setTimeout(runTests, 1000);
