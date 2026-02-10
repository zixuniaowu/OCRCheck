#!/bin/bash
set -e

echo "=== OCRCheck HF Spaces Startup ==="

# --- PostgreSQL initialization ---
PG_DATA="/data/postgresql"
PG_BIN="/usr/lib/postgresql/14/bin"

if [ ! -f "$PG_DATA/PG_VERSION" ]; then
    echo "Initializing PostgreSQL data directory..."
    chown -R postgres:postgres /data/postgresql
    su - postgres -c "$PG_BIN/initdb -D $PG_DATA --encoding=UTF8 --locale=C"

    # Start PostgreSQL temporarily for setup
    su - postgres -c "$PG_BIN/pg_ctl -D $PG_DATA -l /tmp/pg_init.log start -w"

    # Create user and database
    su - postgres -c "psql -c \"CREATE USER ocrcheck WITH PASSWORD 'ocrcheck';\""
    su - postgres -c "psql -c \"CREATE DATABASE ocrcheck OWNER ocrcheck;\""
    su - postgres -c "psql -d ocrcheck -c \"CREATE EXTENSION IF NOT EXISTS pg_trgm;\""

    # Stop temporary PostgreSQL
    su - postgres -c "$PG_BIN/pg_ctl -D $PG_DATA stop -w"

    echo "PostgreSQL initialized."
else
    echo "PostgreSQL data directory already exists."
    chown -R postgres:postgres /data/postgresql
fi

# --- Ensure directories ---
mkdir -p /data/uploads /data/redis /var/log
chown -R redis:redis /data/redis 2>/dev/null || true

# --- Remove default nginx site if it conflicts ---
rm -f /etc/nginx/sites-enabled/default
ln -sf /etc/nginx/sites-available/default /etc/nginx/sites-enabled/default

echo "Starting supervisord..."
exec /usr/bin/supervisord -c /etc/supervisor/supervisord.conf
