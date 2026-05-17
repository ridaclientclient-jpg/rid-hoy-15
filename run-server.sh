#!/bin/bash
cd /home/z/my-project/.next/standalone
exec node --max-old-space-size=256 server.js
