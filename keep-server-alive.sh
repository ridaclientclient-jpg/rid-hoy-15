#!/bin/bash
cd /home/z/my-project/.next/standalone
while true; do
  node --max-old-space-size=256 server.js 2>&1
  echo "Server died, restarting in 2s..."
  sleep 2
done
