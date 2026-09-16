# HUSEHOLD Deployment Guide

Complete guide for deploying HUSEHOLD on a Raspberry Pi.

## Raspberry Pi Setup

### Prerequisites
- Raspberry Pi 3B+ or newer (with ~1GB RAM minimum)
- Raspberry Pi OS (Bullseye or newer)
- SSH access enabled
- Static IP configured (recommended)

### 1. Install System Dependencies

```bash
sudo apt update
sudo apt upgrade -y
sudo apt install -y python3 python3-pip python3-venv python3-dev git nodejs npm nginx sqlite3
```

### 2. Create Application User

```bash
sudo useradd -m -s /bin/bash husehold
sudo su - husehold
```

### 3. Clone the Repository

```bash
cd ~
git clone https://github.com/YOUR_USERNAME/husehold.git
cd husehold
```

### 4. Setup Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

Create `.env` file:
```bash
cp .env.example .env
# Edit .env with your secret key and settings
nano .env
```

Initialize database:
```bash
python manage.py migrate
python manage.py createsuperuser
python manage.py collectstatic --noinput
```

### 5. Setup Frontend

```bash
cd ../frontend
npm install
npm run build
```

### 6. Configure Gunicorn

Create `/etc/systemd/system/gunicorn.service`:

```ini
[Unit]
Description=Gunicorn daemon for HUSEHOLD
After=network.target

[Service]
Type=notify
User=husehold
Group=www-data
WorkingDirectory=/home/husehold/husehold/backend
ExecStart=/home/husehold/husehold/backend/venv/bin/gunicorn --workers 2 --bind 127.0.0.1:8000 config.wsgi:application

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl daemon-reload
sudo systemctl enable gunicorn
sudo systemctl start gunicorn
```

### 7. Configure Nginx

Create `/etc/nginx/sites-available/husehold`:

```nginx
upstream gunicorn {
    server 127.0.0.1:8000;
}

server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    # Frontend static files
    location / {
        alias /home/husehold/husehold/frontend/dist/;
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api {
        proxy_pass http://gunicorn;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Django admin
    location /admin {
        proxy_pass http://gunicorn;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Static files
    location /static {
        alias /home/husehold/husehold/backend/staticfiles/;
    }
}
```

Enable site:
```bash
sudo ln -s /etc/nginx/sites-available/husehold /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
```

## Deployment Workflow

### Manual Deployment

1. SSH into the Pi:
   ```bash
   ssh husehold@<pi-ip>
   cd ~/husehold
   ```

2. Pull latest changes:
   ```bash
   git pull origin main
   ```

3. Run deployment script:
   ```bash
   chmod +x deploy.sh
   ./deploy.sh
   ```

4. Restart services:
   ```bash
   sudo systemctl restart gunicorn nginx
   ```

### Automated Deployment (Git Hook)

Create `/home/husehold/husehold.git/hooks/post-receive`:

```bash
#!/bin/bash
WORK_TREE="/home/husehold/husehold" git checkout -f
cd $WORK_TREE
./deploy.sh
sudo systemctl restart gunicorn
```

Make executable:
```bash
chmod +x /home/husehold/husehold.git/hooks/post-receive
```

Then on your local machine, add the Pi as a remote:
```bash
git remote add pi ssh://husehold@<pi-ip>/home/husehold/husehold.git
git push pi main
```

## Access the Application

Open your browser and navigate to:
- Frontend: `http://<pi-ip>`
- Admin: `http://<pi-ip>/admin`
- API: `http://<pi-ip>/api`

## Troubleshooting

### Check logs
```bash
# Gunicorn
sudo journalctl -u gunicorn -f

# Nginx
sudo tail -f /var/log/nginx/error.log
```

### Database issues
```bash
python manage.py migrate --run-syncdb
```

### Frontend build issues
```bash
cd frontend
rm -rf node_modules dist
npm install
npm run build
```

## Maintenance

### Backup database
```bash
cp /home/husehold/husehold/backend/db.sqlite3 ~/db.sqlite3.backup
```

### Update dependencies
```bash
cd backend
source venv/bin/activate
pip install -r requirements.txt -U
cd ../frontend
npm update
```

## Security Notes

- Change the Django SECRET_KEY in `.env`
- Keep Raspberry Pi OS updated: `sudo apt update && sudo apt upgrade`
- Consider using HTTPS with Let's Encrypt (certbot)
- Restrict SSH access to known IPs
- Use strong passwords for Django superuser
