#!/bin/bash
cd /home/z/my-project/.next/standalone
while true; do
  if ! pgrep -f "next-server" > /dev/null 2>&1; then
    NODE_OPTIONS="--max-old-space-size=256" node server.js >> /tmp/my-project/server.log 2>&1 &
    CHILD_PID=$!
    echo "$(date): Started server PID=$CHILD_PID" >> /tmp/my-project/server.log
  fi
  sleep 3
done
