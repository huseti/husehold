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

### 5. Setup Frontend (one-time only)

This first build can happen on the Pi to get things running, but going forward, builds should happen on your laptop (see **Deployment Workflow** below) — a Pi 3 with 1GB RAM struggles with Vite's build process alongside Django/Gunicorn/Nginx already running.

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

The frontend is **built on your laptop**, not on the Pi. A Raspberry Pi 3 only has 1GB RAM, and Vite's bundler can use 300-500MB+ during a build — on top of Django, Gunicorn, and Nginx already running, that risks swap thrashing or the build getting OOM-killed. Building locally is fast and keeps the Pi free to just serve files.

The split:
- **`deploy.sh`** — runs ON the Pi. Pulls Python deps, runs migrations, collects static files, restarts Gunicorn. (Backend only — no Node.js needed here.)
- **`deploy.ps1`** — runs on your LAPTOP. Builds the frontend with `npm run build`, copies the `dist/` folder to the Pi, then triggers `deploy.sh` remotely over SSH.

### Deploying a new version

After committing and pushing your changes to GitHub:

```powershell
.\deploy.ps1
```

That single command:
1. Builds the React frontend locally (`npm run build`)
2. SSHs into the Pi and runs `git pull origin main` (updates backend code)
3. Copies the freshly-built `frontend/dist/` folder to the Pi via `scp`
4. Runs `deploy.sh` on the Pi (installs any new Python deps, migrates, collects static, restarts Gunicorn)

Nginx doesn't need restarting — it just reads whatever files currently exist in `dist/` and `staticfiles/`.

### First-time setup note

If your SSH username or Pi IP differs from the defaults, override them:
```powershell
.\deploy.ps1 -PiHost "yourname@192.168.1.x" -PiPath "~/husehold"
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

### 403 Forbidden from nginx

If nginx returns 403 for the frontend even though the files exist, it's almost always a permissions issue: nginx runs as `www-data`, which needs *execute* permission on every directory in the path to the file (not just read permission on the file itself). Check with:

```bash
namei -l /path/to/frontend/dist/index.html
```

Also watch out for group membership: Linux applies the file's **group** permission bits to any user who is a member of that group — even if "other" permissions are more permissive. If `www-data` belongs to the directory's owning group, an overly restrictive group permission (e.g. `---`) will block access regardless of what "other" allows. Check with `id www-data`. `deploy.sh` already handles this for `frontend/dist/` on every deploy (`chmod -R g+rX`).

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
