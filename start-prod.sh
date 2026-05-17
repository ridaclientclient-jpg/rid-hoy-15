#!/bin/bash
# Auto-restarting production server for RIDA app
# Uses setsid to fully detach from terminal

LOGFILE="/tmp/rida-prod.log"
cd /home/z/my-project

echo "$(date) === RIDA Production Server Starting ===" >> $LOGFILE

while true; do
  echo "$(date) Starting next start..." >> $LOGFILE
  
  # Start server in a new session, fully detached
  NODE_OPTIONS="--max-old-space-size=512" setsid npx next start -p 3000 >> $LOGFILE 2>&1
  EXIT_CODE=$?
  
  echo "$(date) Server exited with code: $EXIT_CODE" >> $LOGFILE
  
  # Don't restart too fast
  sleep 3
done
