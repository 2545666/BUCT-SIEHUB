#!/usr/bin/env bash
set -euo pipefail

release_dir="$(realpath "${1:?release directory required}")"
site_dir=/var/www/sievox
release_id="$(date -u +%Y%m%dT%H%M%SZ)-$$"
backup_dir="/var/backups/sievox/$release_id"
test -f "$release_dir/backend/server.js"
test -f "$release_dir/frontend/dist/index.html"
test -d "$site_dir/backend"
mkdir -p "$backup_dir" "$site_dir/frontend/releases"
chmod 700 "$backup_dir"

# Persistent attachments stay in place; source and database have their own rollback copies.
tar --exclude=node_modules --exclude='*uploads*' -czf "$backup_dir/backend.tar.gz" -C "$site_dir" backend
cp -a "$site_dir/frontend/dist" "$backup_dir/dist"
tar --exclude=node_modules --exclude=dist --exclude=releases --exclude='dist.*' -czf "$backup_dir/frontend-source.tar.gz" -C "$site_dir" frontend
cp -a /etc/nginx/sites-enabled/resona "$backup_dir/nginx.conf"
cp -a /etc/mongod.conf "$backup_dir/mongod.conf"
pm2 save >/dev/null
cp -a /root/.pm2/dump.pm2 "$backup_dir/pm2.json"
if test -f /etc/sievox/mongodump.yml; then
  mongodump --config=/etc/sievox/mongodump.yml --db buct_feedback --archive="$backup_dir/database.archive.gz" --gzip >/dev/null 2>"$backup_dir/mongodump.log"
else
  mongodump --host 127.0.0.1 --port 27017 --db buct_feedback --archive="$backup_dir/database.archive.gz" --gzip >/dev/null 2>"$backup_dir/mongodump.log"
fi
find "$backup_dir" -maxdepth 1 -type f -exec chmod 600 {} +

new_dist="$site_dir/frontend/releases/$release_id"
cp -a "$release_dir/frontend/dist" "$new_dist"
if test -d "$site_dir/frontend/dist/assets"; then
  cp -an "$site_dir/frontend/dist/assets/." "$new_dist/assets/"
fi

restart_backend() {
  (cd "$site_dir/backend" && node -e 'require("dotenv").config({ override: true }); const { spawnSync } = require("node:child_process"); const result = spawnSync("pm2", ["restart", "sievox-backend", "--update-env"], { env: process.env, stdio: "inherit" }); process.exit(result.status ?? 1);')
}

restore_backend() {
  tar -xzf "$backup_dir/backend.tar.gz" -C "$site_dir"
  (cd "$site_dir/backend" && npm ci --omit=dev --registry=https://registry.npmjs.org >/dev/null)
  restart_backend >/dev/null
}

rsync -a --exclude=node_modules --exclude='.env*' --exclude='*uploads*' --exclude=ssl "$release_dir/backend/" "$site_dir/backend/"
rm -f "$site_dir/backend/department-monthly-performance.test.js"
rsync -a --exclude=node_modules --exclude='.env*' --exclude=dist --exclude=releases "$release_dir/frontend/" "$site_dir/frontend/"
if ! (cd "$site_dir/backend" && npm ci --omit=dev --registry=https://registry.npmjs.org && node --check server.js && npm test); then
  restore_backend
  exit 1
fi
if ! restart_backend; then
  restore_backend
  exit 1
fi
healthy=0
for attempt in $(seq 1 20); do
  if curl --silent --fail http://127.0.0.1:3101/api/health >/dev/null; then healthy=1; break; fi
  sleep 1
done
if test "$healthy" != 1; then
  restore_backend
  exit 1
fi

old_dist="$site_dir/frontend/dist.before-$release_id"
if test -L "$site_dir/frontend/dist"; then
  cp -a "$site_dir/frontend/dist" "$old_dist"
else
  mv "$site_dir/frontend/dist" "$old_dist"
fi
ln -s "$new_dist" "$site_dir/frontend/.dist.next-$release_id"
mv -Tf "$site_dir/frontend/.dist.next-$release_id" "$site_dir/frontend/dist"
if ! curl --silent --fail --resolve sievox.cn:443:127.0.0.1 https://sievox.cn/ >/dev/null; then
  unlink "$site_dir/frontend/dist"
  mv "$old_dist" "$site_dir/frontend/dist"
  restore_backend
  exit 1
fi
pm2 save >/dev/null
printf 'Deployed %s; backup: %s\n' "$release_id" "$backup_dir"
