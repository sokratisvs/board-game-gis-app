#!/bin/sh
# Run all migration SQL files in order against the DB. Idempotent; safe on existing DBs.
set -e

until PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -c '\q' 2>/dev/null; do
  echo "Waiting for Postgres at $DB_HOST..."
  sleep 2
done

echo "Postgres is up. Running migrations..."
for f in /migrations/*.sql; do
  [ -f "$f" ] || continue
  echo "Running $(basename "$f")..."
  PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -f "$f"
done
echo "Migrations done."
