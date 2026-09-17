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

### 7. Configure Nginx (with HTTPS)

Web Push notifications require a secure context, so the Pi terminates HTTPS with a self-signed cert (no public domain here, so Let's Encrypt isn't an option -- a self-signed cert is fine on a LAN-only device; browsers show a one-time warning per device that can be accepted permanently).

Generate the cert once:
```bash
sudo mkdir -p /etc/nginx/ssl
sudo openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
  -keyout /etc/nginx/ssl/husehold-selfsigned.key \
  -out /etc/nginx/ssl/husehold-selfsigned.crt \
  -subj "/CN=<pi-ip>"
```

Create `/etc/nginx/sites-available/husehold` (adjust the paths to match your actual app user's home directory):

```nginx
upstream gunicorn {
    server 127.0.0.1:8000;
}

server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl default_server;
    listen [::]:443 ssl default_server;
    server_name _;

    ssl_certificate /etc/nginx/ssl/husehold-selfsigned.crt;
    ssl_certificate_key /etc/nginx/ssl/husehold-selfsigned.key;

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

If a firewall (`ufw`) is active, make sure 443 is allowed from your LAN in addition to 80:
```bash
sudo ufw allow from <your-lan-subnet> to any port 443 proto tcp
```

### 7b. Optional: a real trusted certificate via free dynamic DNS

The self-signed cert above works everywhere, but some browsers/devices refuse to let you click through an untrusted-certificate warning at all (e.g. some managed/locked-down phones, or stricter browser policies). If you hit that, you can get a real, publicly-trusted certificate for a free dynamic-DNS hostname (e.g. from [duckdns.org](https://www.duckdns.org)) — this does **not** require exposing the Pi to the public internet.

The trick: DNS-01 challenges (used by Let's Encrypt) only require proving you control the DNS record, not that the hostname resolves to a real, publicly reachable address. So you register a free subdomain (e.g. `<your-name>.duckdns.org`), point its DNS record at your Pi's *private* LAN IP, and let clients on your home network/VPN resolve it there — nothing is port-forwarded, and the firewall rules above stay unchanged.

Steps:
1. Register a free subdomain with a dynamic DNS provider that has a simple update API (DuckDNS is a good option). Set its IP to your Pi's LAN IP.
2. Install certbot: `sudo apt install -y certbot`
3. Write an auth-hook script that updates the provider's TXT record for the DNS-01 challenge (check your provider's docs — most have a one-line `curl` call for this), e.g. `/usr/local/bin/dns-auth-hook.sh`, made executable and root-only (`chmod 700`) since it embeds your provider API token — **never commit this script or its token to the repo**.
4. Request the cert:
   ```bash
   sudo certbot certonly --manual --preferred-challenges dns \
     --manual-auth-hook /usr/local/bin/dns-auth-hook.sh \
     -d <your-subdomain> --agree-tos -m <your-email> --no-eff-email
   ```
5. Add a second `server { listen 443 ssl; server_name <your-subdomain>; ... }` block to the nginx config above (same `location` blocks as the existing one), pointing `ssl_certificate`/`ssl_certificate_key` at `/etc/letsencrypt/live/<your-subdomain>/fullchain.pem` / `privkey.pem`. Keep the original self-signed `default_server` block as-is, so plain-IP access still works for other devices.
6. Add `<your-subdomain>` to `ALLOWED_HOSTS` and `https://<your-subdomain>` to `CORS_ALLOWED_ORIGINS` in `.env` — otherwise the static frontend loads but API calls (login, admin) get rejected by Django's host-header check.
7. Set up auto-renewal: certbot's systemd timer (`certbot.timer`, installed automatically) handles this unattended as long as the auth-hook is non-interactive. Certbot doesn't reload nginx after renewing on its own though — add a deploy-hook so the new cert actually gets picked up:
   ```bash
   sudo tee /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh > /dev/null << 'EOF'
   #!/bin/bash
   systemctl reload nginx
   EOF
   sudo chmod +x /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
   ```
   Verify the whole flow with `sudo certbot renew --dry-run`.

Note: the hostname itself becomes publicly visible (via Certificate Transparency logs) once a cert is issued for it — that's just the name string, not a security exposure, since nothing is port-forwarded and reachability is still governed entirely by your firewall rules.

### 8. Notifications setup

Notifications (email + push) are sent by a Django management command, not a background daemon -- schedule it with cron:

```bash
crontab -e
```

Add (runs every 15 minutes -- adjust the path if your app user/directory differs):
```
*/15 * * * * cd /home/husehold/husehold/backend && venv/bin/python manage.py send_notifications >> /home/husehold/husehold/backend/notifications.log 2>&1
```

(On this project's actual Pi, the app user is `admin`, not `husehold` -- see [CLAUDE.md](CLAUDE.md).)

Required one-time setup in `backend/.env` on the Pi (see `.env.example`):
- `EMAIL_HOST`/`EMAIL_PORT`/`EMAIL_HOST_USER`/`EMAIL_HOST_PASSWORD`/`EMAIL_USE_TLS`/`DEFAULT_FROM_EMAIL` -- SMTP credentials for sending email. Leaving `EMAIL_HOST` unset falls back to printing emails to the console instead of erroring.
- `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`/`VAPID_ADMIN_EMAIL` -- generate once with `python manage.py generate_vapid_keys` and never regenerate afterwards (it would invalidate every device's existing push subscription).

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
- Frontend: `https://<pi-ip>`
- Admin: `https://<pi-ip>/admin`
- API: `https://<pi-ip>/api`

Since the cert is self-signed, the browser will warn on first visit per device -- accept/proceed once, it won't ask again on that device.

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
- HTTPS is handled via a self-signed cert (see Nginx setup above) rather than Let's Encrypt, since the Pi has no public domain -- Let's Encrypt requires one
- Restrict SSH access to known IPs
- Use strong passwords for Django superuser
