#!/bin/sh
# Recreate /data dir after volume mount (volume may have been mounted as root)
mkdir -p /data
chown -R 1001:101 /data 2>/dev/null || true
mkdir -p /data/uploads 2>/dev/null || true
# Change to server dir and start Node as appuser
cd /app/server
exec su-exec 1001:101 node index.js
