#!/bin/bash
set -euo pipefail

# ---------------------------------------------------------------------------- #
echo "Updating package lists..."
sudo apt-get update -y

# ---------------------------------------------------------------------------- #
echo "Installing Postgres..."
sudo apt-get install -y postgresql postgresql-contrib

# ---------------------------------------------------------------------------- #
echo "Installing NGINX..."
sudo apt-get install -y nginx

# ---------------------------------------------------------------------------- #
echo "Installing Node.js and npm..."
# Example: Node 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# ---------------------------------------------------------------------------- #
echo "Installing PM2 globally..."
sudo npm install -g pm2

# ---------------------------------------------------------------------------- #
echo "Entering backend directory..."
cd ~/Dev/gaby/gaby-shared-album-backend

# ---------------------------------------------------------------------------- #
echo "Loading environment variables..."
set -a
source .env
set +a

# ---------------------------------------------------------------------------- #
echo "Stopping existing instances..."
sudo systemctl stop nginx || true
pm2 stop backend-server || true

# ---------------------------------------------------------------------------- #
echo "Pulling latest code..."
git pull origin main

# ---------------------------------------------------------------------------- #
echo "Ensuring media directories exist..."
MEDIA_ROOT="/var/www/gaby-shared-album"
TMP_DIR="$MEDIA_ROOT/$TEMP_IMAGE_FILE_PATH"
ORIG_DIR="$MEDIA_ROOT/$ORIGINAL_SCALE_IMAGE_FILE_PATH"
FULL_DIR="$MEDIA_ROOT/$FULL_SCALE_IMAGE_FILE_PATH"
DOWN_DIR="$MEDIA_ROOT/$DOWN_SCALE_IMAGE_FILE_PATH"

mkdir -p "$TMP_DIR" "$ORIG_DIR" "$FULL_DIR" "$DOWN_DIR"
echo "All media directories created."

# ---------------------------------------------------------------------------- #
echo "Setting up Postgres user and database..."
DB_SUDO_USER="${DB_SUDO_USER:-postgres}"
DB_SUDO_PASSWORD="${DB_SUDO_PASSWORD:-}"
DB_USER="${DB_USER:-myapp_user}"
DB_PASS="${DB_PASS:-strong_password}"
DB_NAME="${DB_NAME:-myapp_db}"

PGPASSWORD="$DB_SUDO_PASSWORD" psql -v ON_ERROR_STOP=1 --username "$DB_SUDO_USER" <<-PSQL
DO
\$do\$
BEGIN
   IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '${DB_USER}') THEN
      CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASS}';
   END IF;
END
\$do\$;

DO
\$do\$
BEGIN
   IF NOT EXISTS (SELECT FROM pg_database WHERE datname = '${DB_NAME}') THEN
      CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};
   END IF;
END
\$do\$;

GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};

\connect ${DB_NAME}
CREATE TABLE IF NOT EXISTS photos (
  id TEXT PRIMARY KEY,
  title TEXT,
  caption TEXT,
  upload_date DATE,
  image_endpoint TEXT NOT NULL,
  placeholder_endpoint TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
PSQL

echo "Database ${DB_NAME} and user ${DB_USER} ensured."

# ---------------------------------------------------------------------------- #
echo "Updating NGINX configuration..."
sudo cp ./nginx/gaby-shared-album.com /etc/nginx/sites-available/gaby-shared-album.com
sudo ln -sf /etc/nginx/sites-available/gaby-shared-album.com /etc/nginx/sites-enabled/
sudo nginx -t

# ---------------------------------------------------------------------------- #
echo "Restarting NGINX..."
sudo systemctl reload nginx

# ---------------------------------------------------------------------------- #
echo "Installing Node dependencies..."
npm install

# ---------------------------------------------------------------------------- #
echo "Restarting backend service with PM2..."
pm2 restart backend-server || pm2 start app.js --name backend-server

# ---------------------------------------------------------------------------- #
echo "Ensuring PM2 persists across reboots..."
pm2 startup systemd -u $USER --hp /home/$USER
pm2 save
