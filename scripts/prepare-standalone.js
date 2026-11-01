const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const standaloneDir = path.join(rootDir, '.next', 'standalone');

function copyDirSync(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

console.log('📦 Preparing Standalone build for cPanel deployment...');

if (!fs.existsSync(standaloneDir)) {
  console.error('❌ Error: .next/standalone directory not found. Please run "npm run build" first.');
  process.exit(1);
}

// 1. Copy public directory to standalone/public
const publicSrc = path.join(rootDir, 'public');
const publicDest = path.join(standaloneDir, 'public');
if (fs.existsSync(publicSrc)) {
  console.log('  -> Copying public/ to standalone/public...');
  copyDirSync(publicSrc, publicDest);

  // 1b. Also copy contents of public/ directly to standalone root for direct Apache serving
  console.log('  -> Copying public/ assets directly to standalone root for direct Apache serving...');
  const publicEntries = fs.readdirSync(publicSrc);
  for (const entry of publicEntries) {
    const srcPath = path.join(publicSrc, entry);
    const destPath = path.join(standaloneDir, entry);
    if (fs.statSync(srcPath).isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// 2. Copy .next/static to standalone/.next/static (required by Next standalone server)
const staticSrc = path.join(rootDir, '.next', 'static');
const staticDest = path.join(standaloneDir, '.next', 'static');
if (fs.existsSync(staticSrc)) {
  console.log('  -> Copying .next/static to standalone/.next/static...');
  copyDirSync(staticSrc, staticDest);
}

// 3. Copy .next/static to standalone/_next/static (with underscore for Apache direct static serving)
const staticUnderscoreDest = path.join(standaloneDir, '_next', 'static');
if (fs.existsSync(staticSrc)) {
  console.log('  -> Copying .next/static to standalone/_next/static for Apache static serving...');
  copyDirSync(staticSrc, staticUnderscoreDest);
}

// 4. Copy prisma directory to standalone/prisma
const prismaSrc = path.join(rootDir, 'prisma');
const prismaDest = path.join(standaloneDir, 'prisma');
if (fs.existsSync(prismaSrc)) {
  console.log('  -> Copying prisma/ to standalone/prisma...');
  copyDirSync(prismaSrc, prismaDest);
}

// 5. Copy essential runtime dependencies (bcryptjs, nodemailer) that Next standalone tracing may omit
const extraModules = ['bcryptjs', 'nodemailer'];
for (const mod of extraModules) {
  const modSrc = path.join(rootDir, 'node_modules', mod);
  const modDest = path.join(standaloneDir, 'node_modules', mod);
  if (fs.existsSync(modSrc)) {
    console.log(`  -> Ensuring node_modules/${mod} is included in standalone...`);
    copyDirSync(modSrc, modDest);
  }
}

// 5b. Handle Turbopack hashed external Prisma packages (e.g. @prisma/client-2c3a283f134fdcb6)
const prismaClientDir = path.join(standaloneDir, 'node_modules', '@prisma', 'client');
if (fs.existsSync(prismaClientDir)) {
  const chunksDir = path.join(rootDir, '.next', 'server', 'chunks');
  const foundHashes = new Set(['client-2c3a283f134fdcb6']);
  if (fs.existsSync(chunksDir)) {
    const chunkFiles = fs.readdirSync(chunksDir);
    for (const file of chunkFiles) {
      if (file.endsWith('.js')) {
        const content = fs.readFileSync(path.join(chunksDir, file), 'utf-8');
        const matches = content.match(/@prisma\/(client-[a-f0-9]+)/g);
        if (matches) {
          for (const m of matches) {
            foundHashes.add(m.replace('@prisma/', ''));
          }
        }
      }
    }
  }
  for (const hashPkg of foundHashes) {
    const dest = path.join(standaloneDir, 'node_modules', '@prisma', hashPkg);
    if (!fs.existsSync(dest)) {
      console.log(`  -> Creating alias @prisma/${hashPkg} for Turbopack standalone runtime...`);
      copyDirSync(prismaClientDir, dest);
    }
  }
}

// 6. Ensure logs directory and initial log files exist in standalone
const standaloneLogsDir = path.join(standaloneDir, 'logs');
fs.mkdirSync(standaloneLogsDir, { recursive: true });
const errorLogPath = path.join(standaloneLogsDir, 'error.log');
const appLogPath = path.join(standaloneLogsDir, 'app.log');
if (!fs.existsSync(errorLogPath)) fs.writeFileSync(errorLogPath, `[${new Date().toISOString()}] [INFO] [INIT] Error log initialized.\n`, 'utf-8');
if (!fs.existsSync(appLogPath)) fs.writeFileSync(appLogPath, `[${new Date().toISOString()}] [INFO] [INIT] Application log initialized.\n`, 'utf-8');
console.log('  -> Initialized logs/ directory with error.log and app.log...');

// 7. Generate a universal server.js and app.js tailored for Phusion Passenger & Node
const passengerServerCode = `// Universal Phusion Passenger & Node.js HTTP Server for RotaBeat
const http = require('http');
const path = require('path');
const fs = require('fs');
const Module = require('module');

// Intercept Turbopack hashed externals like @prisma/client-[hash] and resolve to @prisma/client
const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) {
  if (typeof request === 'string' && request.startsWith('@prisma/client-')) {
    return originalResolveFilename.call(this, '@prisma/client', parent, isMain, options);
  }
  return originalResolveFilename.call(this, request, parent, isMain, options);
};

// Polyfills for older Node versions if applicable
if (!Array.prototype.toSorted) {
  Array.prototype.toSorted = function(fn) { return [...this].sort(fn); };
}

const dir = path.resolve(__dirname);
process.env.NODE_ENV = 'production';
process.chdir(dir);

// Explicitly load .env file into process.env for Standalone runtime
try {
  const { loadEnvConfig } = require('@next/env');
  loadEnvConfig(dir);
} catch (e) {
  console.warn('Notice: @next/env load skipped, using fallback reader:', e.message);
}

// Fallback reader to guarantee all .env variables are present
try {
  const envFile = path.join(dir, '.env');
  if (fs.existsSync(envFile)) {
    const rawEnv = fs.readFileSync(envFile, 'utf-8');
    rawEnv.split(/\r?\n/).forEach(function(line) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx > 0) {
        const key = trimmed.slice(0, eqIdx).trim();
        let val = trimmed.slice(eqIdx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    });
  }
} catch (e) {}

if (process.env.DATABASE_URL) {
  const sanitized = process.env.DATABASE_URL.replace(/:([^:@]+)@/, ':****@');
  console.log('✅ Loaded DATABASE_URL from .env:', sanitized);
} else {
  console.warn('⚠️ WARNING: DATABASE_URL is not set in process.env!');
}

// Load Next.js configuration
let nextConfig = {};
try {
  const reqFilesPath = path.join(dir, '.next', 'required-server-files.json');
  if (fs.existsSync(reqFilesPath)) {
    const reqFiles = JSON.parse(fs.readFileSync(reqFilesPath, 'utf-8'));
    nextConfig = reqFiles.config || {};
  }
} catch (e) {
  console.warn('Warning loading required-server-files.json:', e.message);
}

nextConfig.outputFileTracingRoot = dir;
nextConfig.repoRoot = dir;
process.env.__NEXT_PRIVATE_STANDALONE_CONFIG = JSON.stringify(nextConfig);

const NextNodeServer = require('next/dist/server/next-server').default;
const nextServer = new NextNodeServer({
  dir,
  dev: false,
  conf: nextConfig,
  minimalMode: false,
});
const handler = nextServer.getRequestHandler();

const server = http.createServer(async (req, res) => {
  try {
    await handler(req, res);
  } catch (err) {
    console.error('Request handler error:', err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.end('Internal Server Error');
    }
  }
});

// Phusion Passenger detection & socket binding
if (typeof PhusionPassenger !== 'undefined') {
  console.log('Starting RotaBeat with Phusion Passenger...');
  server.listen('passenger');
} else {
  const port = process.env.PORT || 3000;
  console.log('Starting RotaBeat server on port ' + port + '...');
  server.listen(port);
}
`;

// Write both server.js and app.js so cPanel works regardless of startup file configured
fs.writeFileSync(path.join(standaloneDir, 'server.js'), passengerServerCode, 'utf-8');
fs.writeFileSync(path.join(standaloneDir, 'app.js'), passengerServerCode, 'utf-8');
console.log('  -> Generated universal server.js and app.js with native Phusion Passenger support...');

// 8. Create production .env for deployment
const envProdPath = path.join(standaloneDir, '.env');
const envContent = `# Production Environment Variables for working-emerald-mockingbird.72-167-148-243.cpanel.site
DATABASE_URL="mysql://rotaflow_user:bMEX6Kloe22M@localhost:3306/rotabeat"
NEXT_PUBLIC_BASE_PATH=
NEXT_PUBLIC_APP_URL=http://working-emerald-mockingbird.72-167-148-243.cpanel.site
NODE_ENV=production
PORT=3000
SESSION_SECRET=rotaflow_production_secure_secret_key_8f3a1d9c
APP_ROOT_DIR=/home/rotaflow/public_html
`;
fs.writeFileSync(envProdPath, envContent, 'utf-8');
console.log('  -> Generated production .env in standalone directory...');

// 9. Create .htaccess for Apache Reverse Proxy (tested & working)
const htaccessPath = path.join(standaloneDir, '.htaccess');
const htaccessContent = `RewriteEngine On

# 1. Serve static files directly if they exist
RewriteCond %{REQUEST_FILENAME} -f [OR]
RewriteCond %{REQUEST_FILENAME} -d
RewriteRule ^ - [L]

# 2. Check and serve static files from public/ subfolder directly
RewriteCond %{DOCUMENT_ROOT}/public/$1 -f
RewriteRule ^(.*)$ public/$1 [L]

# 3. Forward everything else to port 3000 where RotaBeat is running
RewriteRule ^(.*)$ http://127.0.0.1:3000/$1 [P,L]
`;
fs.writeFileSync(htaccessPath, htaccessContent, 'utf-8');
console.log('  -> Generated .htaccess in standalone directory...');

// 10. Create deployable zip archive: deploy_rota_v2.zip
const zipDest = path.join(rootDir, 'deploy_rota_v2.zip');
try {
  console.log('  -> Creating deploy_rota_v2.zip...');
  if (process.platform === 'win32') {
    execSync(`powershell -Command "Compress-Archive -Path '${standaloneDir}\\*' -DestinationPath '${zipDest}' -Force"`, { stdio: 'inherit' });
  } else {
    execSync(`cd "${standaloneDir}" && zip -r "${zipDest}" .`, { stdio: 'inherit' });
  }
  console.log(`✅ Deployment zip successfully created: deploy_rota_v2.zip`);
} catch (err) {
  console.warn('⚠️ Could not automatically create zip file, but standalone folder is fully ready:', err.message);
}

console.log('🎉 Standalone package is ready in .next/standalone for deployment!');
