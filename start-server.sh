#!/bin/bash
# RIDA SUPREME SYSTEM - Production Server Startup Script
# Starts the Next.js standalone server with auto-restart capability

cd /home/z/my-project

# Kill any existing server on port 3000
fuser -k 3000/tcp 2>/dev/null
sleep 1

echo "[$(date)] Starting RIDA SUPREME SYSTEM production server..."

# Start with setsid to fully detach from terminal
setsid sh -c 'while true; do
    NODE_ENV=production node /home/z/my-project/.next/standalone/server.js
    EXIT_CODE=$?
    echo "[$(date)] Server exited with code: $EXIT_CODE, restarting in 3s..."
    sleep 3
done' > /tmp/rida-server.log 2>&1

echo "[$(date)] Server started successfully. Logs at /tmp/rida-server.log"
