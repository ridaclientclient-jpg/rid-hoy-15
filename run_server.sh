#!/bin/bash
cd /home/z/my-project
while true; do
  echo "$(date): Starting server..."
  NODE_ENV=production bun .next/standalone/server.js 2>&1
  echo "$(date): Server crashed, restarting in 3s..."
  sleep 3
done
