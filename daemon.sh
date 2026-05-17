#!/bin/bash
cd /home/z/my-project
export NODE_OPTIONS="--max-old-space-size=512"

# Double fork to daemonize
(
  while true; do
    echo "$(date) Starting server..." >> /tmp/rida-server.log
    node .next/standalone/server.js >> /tmp/rida-server.log 2>&1
    echo "$(date) Server died. Restarting in 3s..." >> /tmp/rida-server.log
    sleep 3
  done
) &
DAEMON_PID=$!

# Write PID file
echo $DAEMON_PID > /tmp/rida-daemon.pid
echo "Daemon started with PID: $DAEMON_PID"
