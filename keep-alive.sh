#!/bin/bash
cd /home/z/my-project
while true; do
    echo "[$(date)] Starting server..."
    NODE_ENV=production node .next/standalone/server.js 2>&1
    EXIT_CODE=$?
    echo "[$(date)] Server exited with code: $EXIT_CODE"
    sleep 2
done
