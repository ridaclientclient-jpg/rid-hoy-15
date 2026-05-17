const http = require('http');

const TARGET = 'http://127.0.0.1:3001';

const server = http.createServer((clientReq, clientRes) => {
    const url = new URL(clientReq.url, TARGET);
    
    const options = {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method: clientReq.method,
        headers: clientReq.headers,
    };
    
    const proxyReq = http.request(options, (proxyRes) => {
        clientRes.writeHead(proxyRes.statusCode, proxyRes.headers);
        proxyRes.pipe(clientRes, { end: true });
    });
    
    proxyReq.on('error', (err) => {
        console.error('Proxy error:', err.message);
        clientRes.writeHead(502);
        clientRes.end('Bad Gateway');
    });
    
    clientReq.pipe(proxyReq, { end: true });
});

server.listen(3000, '0.0.0.0', () => {
    console.log('Proxy listening on port 3000 -> 3001');
});
