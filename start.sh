#!/bin/bash
cd /home/z/my-project
while true; do
  echo "[$(date)] Starting RIDA server..."
  node .next/standalone/server.js -p 3000 2>&1 | tee -a /home/z/my-project/app.log
  echo "[$(date)] Server crashed, restarting in 3s..."
  sleep 3
done
