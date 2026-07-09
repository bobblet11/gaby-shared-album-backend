# create folders and nginx config
sudo ./scripts/setup_media_and_nginx.sh

# create postgres user/db and table (runs psql as postgres user)
sudo -u postgres ./scripts/setup_postgres.sh

# # deploy node service (assumes app root is /srv/myapp — edit script if different)
# sudo ./scripts/deploy_node_service.sh

# test DB connection from app user
node scripts/test_db.js
