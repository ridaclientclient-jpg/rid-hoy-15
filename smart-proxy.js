const http = require('http');
const { spawn } = require('child_process');

const NEXT_PORT = 3001;
let nextProcess = null;
let nextReady = false;
let pendingRequests = [];
let restarting = false;

function startNextServer() {
    if (nextProcess || restarting) return;
    restarting = true;
    nextReady = false;
    
    console.log('[Proxy] Starting Next.js server on port ' + NEXT_PORT + '...');
    
    nextProcess = spawn('bun', ['.next/standalone/server.js'], {
        cwd: '/home/z/my-project',
        env: { ...process.env, PORT: String(NEXT_PORT), NODE_ENV: 'production' },
        stdio: ['pipe', 'pipe', 'pipe'],
    });
    
    nextProcess.stdout.on('data', (data) => {
        const msg = data.toString();
        console.log('[Next.js]', msg.trim());
        if (msg.includes('Ready')) {
            nextReady = true;
            restarting = false;
            // Flush pending requests
            while (pendingRequests.length > 0) {
                const { req, res } = pendingRequests.shift();
                forwardRequest(req, res);
            }
        }
    });
    
    nextProcess.stderr.on('data', (data) => {
        console.error('[Next.js ERR]', data.toString().trim());
    });
    
    nextProcess.on('exit', (code) => {
        console.log('[Next.js] Exited with code:', code);
        nextProcess = null;
        nextReady = false;
        restarting = false;
        // Auto-restart after delay
        setTimeout(startNextServer, 2000);
    });
}

function forwardRequest(clientReq, clientRes) {
    const options = {
        hostname: '127.0.0.1',
        port: NEXT_PORT,
        path: clientReq.url,
        method: clientReq.method,
        headers: { ...clientReq.headers, host: '127.0.0.1:' + NEXT_PORT },
    };
    
    const proxyReq = http.request(options, (proxyRes) => {
        clientRes.writeHead(proxyRes.statusCode, proxyRes.headers);
        proxyRes.pipe(clientRes, { end: true });
    });
    
    proxyReq.on('error', (err) => {
        console.error('[Proxy] Forward error:', err.message);
        clientRes.writeHead(502, { 'Content-Type': 'text/html' });
        clientRes.end('<h1>502 Bad Gateway - Restarting...</h1>');
    });
    
    clientReq.pipe(proxyReq, { end: true });
}

const server = http.createServer((req, res) => {
    if (nextReady) {
        forwardRequest(req, res);
    } else {
        // Queue request until Next.js is ready
        pendingRequests.push({ req, res });
        if (pendingRequests.length === 1) {
            // First pending request - show loading
            res.writeHead(503, { 'Content-Type': 'text/html' });
            res.end('<h1>Starting...</h1>');
            pendingRequests.shift(); // Remove the one we already responded to
        }
        if (!nextProcess && !restarting) {
            startNextServer();
        }
    }
});

// Don't bind to 3000 yet - bind to 3001 and let Caddy point there
// Actually, Caddy points to 3000, so let's use 3000
server.listen(3000, '0.0.0.0', () => {
    console.log('[Proxy] Listening on port 3000');
    startNextServer();
});
