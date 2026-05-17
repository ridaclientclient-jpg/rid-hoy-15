#!/bin/bash
cd /home/z/my-project
while true; do
  echo "Starting server at $(date)" >> /home/z/my-project/server-loop.log
  node .next/standalone/server.js >> /home/z/my-project/server-loop.log 2>&1
  echo "Server died at $(date), restarting in 2s..." >> /home/z/my-project/server-loop.log
  sleep 2
done
