#!/bin/bash
cd /home/z/my-project
export NODE_OPTIONS="--max-old-space-size=512"

LOGFILE="/tmp/node-watchdog.log"
echo "$(date) === WATCHDOG STARTED ===" > $LOGFILE

while true; do
    echo "$(date) Starting server..." >> $LOGFILE
    node .next/standalone/server.js >> $LOGFILE 2>&1
    EXITCODE=$?
    echo "$(date) Server exited (code=$EXITCODE). Restarting in 3s..." >> $LOGFILE
    sleep 3
done
