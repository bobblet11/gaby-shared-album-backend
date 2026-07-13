server {
    listen 80;
    listen [::]:80;
    client_max_body_size 50M;
    root /var/www/://gaby-shared-album.com;
    index index.html index.htm;

    server_name _;

    location / {
        root /home/gaylord/Dev/gaby/gaby-shared-album-frontend/build;
        index index.html;
        try_files $uri /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_request_buffering off;
        proxy_read_timeout 300;
    }

    location /media/ {
        alias /var/www/gaby-shared-album/;
        autoindex off;  # set to 'on' if you want directory listing
    }
}
