#!/bin/bash
# Watchdog: keeps the dev server running
cd /home/z/my-project
while true; do
  echo "[$(date)] Starting dev server..."
  node node_modules/.bin/next dev -p 3000 &
  SERVER_PID=$!
  wait $SERVER_PID
  EXIT_CODE=$?
  echo "[$(date)] Dev server exited with code $EXIT_CODE, restarting in 3s..."
  sleep 3
done
