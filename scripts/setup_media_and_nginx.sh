#!/usr/bin/env bash
set -euo pipefail

# Edit these if your .env uses different paths
MEDIA_ROOT="/var/www/media/photo"
TMP_DIR="$MEDIA_ROOT/tmp"
ORIG_DIR="$MEDIA_ROOT/original"
FULL_DIR="$MEDIA_ROOT/full"
DOWN_DIR="$MEDIA_ROOT/down"

NGINX_SITE_SNIPPET="/etc/nginx/snippets/media_photo.conf"
NGINX_SERVER_BLOCK="/etc/nginx/sites-available/media_photo"
NGINX_ENABLED="/etc/nginx/sites-enabled/media_photo"

# Create directories
mkdir -p "$TMP_DIR" "$ORIG_DIR" "$FULL_DIR" "$DOWN_DIR"

# Set ownership to nginx user (www-data on Debian/Ubuntu). Change if your distro uses 'nginx'
NGINX_USER="www-data"
chown -R "$NGINX_USER":"$NGINX_USER" "$MEDIA_ROOT"
chmod -R 0755 "$MEDIA_ROOT"

# Create nginx snippet
cat > "$NGINX_SITE_SNIPPET" <<'NGINX_SNIPPET'
location /media/photo/ {
    alias /var/www/media/photo/;
    autoindex off;
    access_log  /var/log/nginx/media_access.log;
    expires     max;
    add_header  Cache-Control "public, max-age=31536000, immutable";
}
NGINX_SNIPPET

# Create a minimal server block that includes the snippet (safe default)
cat > "$NGINX_SERVER_BLOCK" <<'NGINX_SERVER'
server {
    listen 80;
    server_name _;

    include /etc/nginx/snippets/media_photo.conf;

    location / {
        return 404;
    }
}
NGINX_SERVER

# Enable site (idempotent)
if [ ! -f "$NGINX_ENABLED" ]; then
    ln -sf "$NGINX_SERVER_BLOCK" "$NGINX_ENABLED"
fi

# Test and reload nginx
nginx -t
systemctl reload nginx

echo "Media folders created at $MEDIA_ROOT and NGINX config installed."
echo "If your distro uses a different nginx user, update ownership accordingly."
