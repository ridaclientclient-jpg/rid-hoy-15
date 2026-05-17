const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');

const LOG = '/tmp/rida-keepalive.log';
const PORT = 3000;

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  fs.appendFileSync(LOG, line);
  process.stdout.write(line);
}

function checkServer() {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${PORT}/`, (res) => {
      res.resume();
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(3000, () => { req.destroy(); resolve(false); });
  });
}

async function startServer() {
  return new Promise((resolve, reject) => {
    const child = spawn('node', ['.next/standalone/server.js', '-p', String(PORT)], {
      cwd: '/home/z/my-project',
      env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=512', PORT: String(PORT), NODE_ENV: 'production' },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    child.stdout.on('data', (d) => process.stdout.write(d));
    child.stderr.on('data', (d) => process.stderr.write(d));

    child.on('exit', (code, signal) => {
      log(`Server exited: code=${code} signal=${signal}`);
      resolve();
    });

    child.on('error', (err) => {
      log(`Server error: ${err.message}`);
      resolve();
    });

    // Wait for server to be ready
    let tries = 0;
    const checkReady = setInterval(async () => {
      tries++;
      const alive = await checkServer();
      if (alive || tries > 20) {
        clearInterval(checkReady);
        resolve(child);
      }
    }, 500);
  });
}

async function main() {
  log('=== RIDA Keep-Alive Starting ===');

  while (true) {
    // Check if something is already on the port
    const alreadyUp = await checkServer();
    if (alreadyUp) {
      log(`Server already running on port ${PORT}`);
      await new Promise(r => setTimeout(r, 10000));
      const stillUp = await checkServer();
      if (stillUp) continue;
      log('Server stopped responding, restarting...');
    }

    log('Starting Next.js server...');
    await startServer();
    log('Server process ended, restarting in 2s...');
    await new Promise(r => setTimeout(r, 2000));
  }
}

main().catch(err => {
  log(`Fatal: ${err.message}`);
  process.exit(1);
});
