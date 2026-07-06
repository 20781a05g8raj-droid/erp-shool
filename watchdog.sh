#!/usr/bin/env bash
# Watchdog: keep the Next.js dev server alive on port 3000.
cd /home/z/my-project || exit 1
while true; do
  node node_modules/.bin/next dev -p 3000 >> /home/z/my-project/dev.log 2>&1
  echo "[watchdog] next exited with code $? at $(date); restarting in 3s" >> /home/z/my-project/dev.log
  sleep 3
done
