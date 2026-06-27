# Multi-Tenant Feature Flag System

This is a simple system built to manage and test feature flags across different organizations (tenants). 

It has three main parts:
1. **Backend**: A Node.js and Express server that handles users, organizations, and feature flags. It stores data in a local SQLite file and uses JWT (tokens) for login.
2. **Super Admin Frontend**: A simple panel where you can register new organizations.
3. **Admin Frontend**: A panel where an organization admin can log in, create/toggle feature flags for their company, and create test credentials for end users.
4. **User Frontend**: A page where end users can log in and check if a specific feature is enabled for their organization.

---

## 👥 How the Roles Work

1. **Super Admin**
   - Credentials are hardcoded: Username `superadmin` and Password `superadminpassword`.
   - Used to create new organizations (tenants).

2. **Organization Admin**
   - Can register under any organization created by the Super Admin.
   - Used to manage feature flags (turn them on/off) and create client accounts for that organization.

3. **End User**
   - Log in using credentials created by their Organization Admin.
   - Can search for a feature key (e.g., `enable_dark_mode`) to see if it is enabled or disabled.

---

## 🚀 How to Run the Project

1. **Install everything**
   In the main root directory of the project, run:
   ```bash
   npm install
   cd backend && npm install
   cd ../super-admin-frontend && npm install
   cd ../admin-frontend && npm install
   cd ../user-frontend && npm install
   cd ..
   ```

2. **Start all servers**
   Start the backend and all three frontends at the same time using:
   ```bash
   npm run start-all
   ```
   This will open:
   - Super Admin: http://localhost:3001
   - Organization Admin: http://localhost:3002
   - End User testing: http://localhost:3003
   - Backend API: http://localhost:5001

---

## 🧪 Testing the APIs

We have a test script that automatically verifies all API logic. To run it:
1. Make sure all servers are stopped.
2. Delete the old database file so we start fresh:
   ```bash
   rm -f backend/database.sqlite
   ```
3. Start the backend:
   ```bash
   cd backend && npm run dev
   ```
4. In a separate terminal tab, run the test script:
   ```bash
   cd backend && node verify.js
   ```
5. You should see `All API tests passed successfully!` at the end.
