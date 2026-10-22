# RotaFlow cPanel & VPS Production Deployment Guide

This guide documents the exact, tested deployment architecture and step-by-step procedures for running **RotaFlow** on GoDaddy cPanel VPS at:
- **Domain:** `http://working-emerald-mockingbird.72-167-148-243.cpanel.site/`
- **Server Root Path:** `/home/rotaflow/public_html`
- **Node.js Engine:** EasyApache Node 22 (`/opt/cpanel/ea-nodejs22/bin/node`)

---

## 1. Architecture Overview

```
Browser Request (Port 80)
       │
       ▼
Apache Web Server (/home/rotaflow/public_html)
       │
       ├─► 1. Static Files / CSS / JS / Images  ──► Served directly by Apache (.htaccess)
       │
       └─► 2. All Dynamic Pages & API Routes   ──► Reverse Proxied to http://127.0.0.1:3000
                                                          │
                                                          ▼
                                              RotaFlow Node.js Server
                                              (server.js running via PM2)
                                                          │
                                                          ▼
                                              MySQL Database (localhost:3306)
                                              (rotaflow_db)
```

---

## 2. Configuration Files

### A. Apache Reverse Proxy (`.htaccess`)
File location: `/home/rotaflow/public_html/.htaccess`

```apache
RewriteEngine On

# 1. Serve static files directly if they exist
RewriteCond %{REQUEST_FILENAME} -f [OR]
RewriteCond %{REQUEST_FILENAME} -d
RewriteRule ^ - [L]

# 2. Forward everything else to port 3000 where RotaFlow is running
RewriteRule ^(.*)$ http://127.0.0.1:3000/$1 [P,L]
```

> [!NOTE]
> We use standard Apache `mod_proxy` reverse proxying instead of Phusion Passenger directives (`PassengerAppRoot`, etc.) because EasyApache 4 on this VPS does not have Passenger compiled, which would cause an Apache 500 Internal Server Error.

---

### B. Production Environment (`.env`)
File location: `/home/rotaflow/public_html/.env`

```env
# Production Environment Variables for working-emerald-mockingbird.72-167-148-243.cpanel.site
DATABASE_URL="mysql://rotaflow_user:bMEX6Kloe22M@localhost:3306/rotaflow_db"
NEXT_PUBLIC_BASE_PATH=
NEXT_PUBLIC_APP_URL=http://working-emerald-mockingbird.72-167-148-243.cpanel.site
NODE_ENV=production
PORT=3000
SESSION_SECRET=rotaflow_production_secure_secret_key_8f3a1d9c
APP_ROOT_DIR=/home/rotaflow/public_html
```

> [!TIP]
> If configuring environment variables inside cPanel's **Setup Node.js App** UI, you only need to provide `DATABASE_URL`—all other fallback values are loaded automatically from the `.env` file and `server.js`.

---

## 3. Step-by-Step Deployment Walkthrough

### Step 1: Upload and Extract Files

1. On your local machine, generate the deployment archive:
   ```bash
   node scripts/prepare-standalone.js
   ```
   This generates `deploy_rota_v2.zip` in your project root.
2. In cPanel **File Manager** (ensure *Show Hidden Files* is enabled in Settings), upload `deploy_rota_v2.zip` to:
   ```
   /home/rotaflow/public_html
   ```
3. Extract `deploy_rota_v2.zip` directly into `public_html`.

---

### Step 2: Set Directory Permissions

In cPanel Terminal, ensure Node has execute permissions to traverse directories:
```bash
chmod -R 755 /home/rotaflow/public_html
```

---

### Step 3: Configure "Setup Node.js App" in cPanel UI

1. In your cPanel dashboard, scroll down to **Software** and click **Setup Node.js App**.
2. Click **Create Application** (or edit your existing one).
3. nder **Environment variables**, click **Add Variable**:
   - **Name**: `DATABASE_URL`
   - **Value**: `mysql://rotaflow_user:bMEX6Kloe22M@localhost:3306/rotaflow_db`
   *(Note: This is the only environment variable you need to add in the cPanel UI because all other values such as `PORT=3000`, `NODE_ENV=production`, and `SESSION_SECRET` are read automatically from `.env`).*
4. Click **Create** (or **Save**).

---

### Step 4: Handle Turbopack Prisma External Alias

Next.js Turbopack generates hashed module references for Prisma (e.g. `@prisma/client-2c3a283f134fdcb6`). Ensure the alias folder exists:

```bash
cp -r /home/rotaflow/public_html/node_modules/@prisma/client /home/rotaflow/public_html/node_modules/@prisma/client-2c3a283f134fdcb6
chmod -R 755 /home/rotaflow/public_html/node_modules/@prisma
```

*(Note: `scripts/prepare-standalone.js` and `server.js` have also been equipped with an automatic Node `Module._resolveFilename` resolver hook so future builds include this alias out of the box).*

---

### Step 5: Import Database Schema & Seed Data

Create the database tables and default admin account in MySQL:

```bash
mysql -u rotaflow_user -p'bMEX6Kloe22M' rotaflow_db < /home/rotaflow/public_html/prisma/schema.sql
mysql -u rotaflow_user -p'bMEX6Kloe22M' rotaflow_db < /home/rotaflow/public_html/prisma/seed.sql
```

*(Alternatively, you can open **phpMyAdmin** in cPanel, select `rotaflow_db`, click the **Import** tab, and import `prisma/schema.sql` followed by `prisma/seed.sql`).*

---

### Step 6: Start the Server

#### Method A: Direct Start in Terminal (For Instant Testing & Debugging)

From `/home/rotaflow/public_html`, run:
```bash
/opt/cpanel/ea-nodejs22/bin/node server.js
```
You should see:
```text
Starting RotaFlow server on port 3000...
```
*(Note: Keep the terminal window open while testing, or press `Ctrl + C` when you want to stop it).*

---

#### Method B: Via cPanel "Setup Node.js App" UI
In cPanel -> **Software** -> **Setup Node.js App**:
- Find your application in the list.
- Click the **Start** or **Restart** button.

---

#### Method C: Run in Background 24/7 with Local PM2 (Recommended for Production)

To keep RotaFlow running automatically even after you close the cPanel terminal or log out:

```bash
cd /home/rotaflow/public_html

# 1. Install PM2 locally (since global install is blocked in jailshell)
/opt/cpanel/ea-nodejs22/bin/npm install pm2

# 2. Start RotaFlow under PM2 process manager
./node_modules/.bin/pm2 start server.js --name rotaflow --interpreter /opt/cpanel/ea-nodejs22/bin/node

# 3. Save process list so it persists
./node_modules/.bin/pm2 save
```

*(Alternative quick background command without PM2):*
```bash
nohup /opt/cpanel/ea-nodejs22/bin/node server.js > logs/app.log 2>&1 &
```

---

## 4. Helpful Management Commands

All commands should be run from `/home/rotaflow/public_html`:

| Task | Command |
|---|---|
| **Stop / Kill Server Process** | `pkill -9 -f "server.js"` |
| **Check Port 3000 Status** | `lsof -i :3000` *(or `netstat -tlpn \| grep 3000`)* |
| **Test Local Response** | `curl -I http://127.0.0.1:3000/` |
| **View Live Background Logs** | `tail -f logs/app.log` |
| **PM2 View Status** | `./node_modules/.bin/pm2 status` |
| **PM2 Real-Time Logs** | `./node_modules/.bin/pm2 logs rotaflow` |
| **PM2 Restart** | `./node_modules/.bin/pm2 restart rotaflow` |
| **PM2 Stop** | `./node_modules/.bin/pm2 stop rotaflow` |

### How to Stop and Restart Server Cleanly:
```bash
# 1. Kill any existing instance running server.js
pkill -9 -f "server.js"

# 2. Verify port 3000 is free (should return nothing)
lsof -i :3000

# 3. Start again
nohup /opt/cpanel/ea-nodejs22/bin/node server.js > logs/app.log 2>&1 &
```

---

## 5. Application Access & Default Credentials

Open your web browser and navigate to:
```
http://working-emerald-mockingbird.72-167-148-243.cpanel.site/
```

### Default Business Owner Credentials
- **Username / Email:** `aisha.khan@northerntable.co.uk` (or `aishakhan`)
- **Password:** `Qwertyuiop@123`
- **Role:** Business Owner (Full Administrative Access)
