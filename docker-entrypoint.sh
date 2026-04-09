#!/bin/sh
# Fix ownership of data volume so non-root appuser can write
if [ -d /data ]; then
  chown -R 1001:101 /data
fi
# Clean stale WAL/shm from previous container runs
rm -f /data/*.wal /data/*.shm
# Become non-root user and exec the app
exec su-exec 1001:101 node server/index.js
