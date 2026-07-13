#!/bin/bash
set -euo pipefail

# ---------------------------------------------------------------------------- #
echo "Entering backend directory..."
cd ~/Dev/gaby/gaby-shared-album-backend

# ---------------------------------------------------------------------------- #
echo "Loading env..."
set -a
source .env
set +a

# ---------------------------------------------------------------------------- #
echo "Stopping instances..."
sudo systemctl stop postgresql
sudo systemctl stop nginx
pm2 stop backend-server || true

# ---------------------------------------------------------------------------- #
echo "Restarting Postgres..."
sudo systemctl restart postgresql

# ---------------------------------------------------------------------------- #
echo "Testing Postgres connection..."
node ./scripts/test_db.js

# ---------------------------------------------------------------------------- #
echo "Updating NGINX config..."
sudo cp ./nginx/gaby-shared-album.com /etc/nginx/sites-available/gaby-shared-album.com
sudo ln -sf /etc/nginx/sites-available/gaby-shared-album.com /etc/nginx/sites-enabled/
sudo nginx -t

# ---------------------------------------------------------------------------- #
echo "Installing dependencies..."
npm install

# ---------------------------------------------------------------------------- #
echo "Restarting node backend service"
pm2 restart backend-server --update-env || pm2 start app.js --name backend-server 

# ---------------------------------------------------------------------------- #
echo "Restarting NGINX..."
sudo systemctl start nginx




