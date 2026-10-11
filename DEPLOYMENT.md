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
ExecStart=/home/husehold/husehold/backend/venv/bin/gunicorn --workers 2 --timeout 300 --bind 127.0.0.1:8000 config.wsgi:application

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

    # User uploads (avatars) -- Django only serves these itself when DEBUG=True
    location /media {
        alias /home/husehold/husehold/backend/media/;
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

### 9. Google Calendar setup

One-way, read-only sync of a single shared household calendar into the weekly plan view (see PLANNING.md 2a/6C). Needs a Google Cloud OAuth client, then the same cron pattern as notifications.

1. **Google Cloud Console** (see PLANNING.md item C for the click-by-click version):
   - Create/select a project, enable the **Google Calendar API**.
   - Configure the OAuth consent screen: User type "External", scope `calendar.readonly`, and add both household members' Gmail addresses as **test users** (stays in Testing mode indefinitely for a read-only scope -- no Google review needed).
   - Create an **OAuth client ID** (Web application) with the Pi's origin/redirect URI registered:
     - Authorized JavaScript origin: `https://husehold.duckdns.org`
     - Authorized redirect URI: `https://husehold.duckdns.org/api/google-calendar/callback/`
   - (Optionally add the dev-laptop equivalents -- `http://localhost:3000` / `http://localhost:8000/api/google-calendar/callback/` -- to the same client, so `npm run dev`/`manage.py runserver` can test the flow too.)

2. Add to `backend/.env` on the Pi (see `.env.example`):
   - `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` -- from the OAuth client created above.
   - `FRONTEND_URL=https://husehold.duckdns.org` -- where the OAuth callback redirects the browser back to once linking finishes (defaults to `http://localhost:3000`, which is wrong for the Pi).

3. Add the sync command to cron (`crontab -e`), same 15-minute cadence as notifications:
   ```
   */15 * * * * cd /home/husehold/husehold/backend && venv/bin/python manage.py sync_google_calendar >> /home/husehold/husehold/backend/calendar-sync.log 2>&1
   ```

4. In the app, a household member connects the calendar from **Settings → Google Calendar** -- a one-time click-through of Google's consent screen. Nothing further to configure; disconnecting/reconnecting and pausing sync are also done from there.

### 10. Shopping list categorization (optional)

The shopping list auto-sorts items into categories using a built-in dictionary first, with a Claude API call as a fallback for anything the dictionary doesn't recognize (see PLANNING.md item E). The fallback is entirely optional -- without it, the dictionary alone still covers common groceries, and anything unrecognized just lands in "Uncategorized" until corrected by hand.

1. Create an account at [console.anthropic.com](https://console.anthropic.com), add some prepaid credit, and generate an API key.
2. Add to `backend/.env` (both the Pi and dev, see `.env.example`):
   ```
   ANTHROPIC_API_KEY=sk-ant-...
   ```
3. Redeploy (or just restart Gunicorn) so the new env var is picked up. No cron job needed -- this runs inline whenever a new ingredient/shopping item is created, not on a schedule.

Cost is expected to be negligible (well under $1/year for a 2-person household) -- each call is small and only fires once per genuinely new item name, never for anything already in the dictionary or already-categorized. See PLANNING.md's Item E note for the full reasoning.

### 11. Recipe import (photo / paste text / URL) -- required Nginx step

Recipe import reuses the same `ANTHROPIC_API_KEY` as shopping categorization above (no separate setup) for the photo and paste-text paths, and for URL imports where the page has no `Recipe` JSON-LD. **One manual step is required on the Pi** that this assistant could not do itself -- it needs `sudo` with a password, and only a scoped no-password rule for restarting Gunicorn exists (`sudo -l` on the Pi shows `(ALL) NOPASSWD: /usr/bin/systemctl restart gunicorn` only; everything else still prompts for a password over SSH).

**Why it's needed**: multi-photo import sends a few resized images as base64 JSON, which can comfortably exceed Nginx's default 1MB request body limit -- requests over that get rejected with a 413 before they ever reach Django (whose own limit was already raised to 20MB in `settings.py`, but that doesn't help if Nginx rejects first).

**Run this once on the Pi** (SSH in, this will prompt for your sudo password):
```bash
sudo sed -i '/^http {/a\    client_max_body_size 20M;' /etc/nginx/nginx.conf
sudo nginx -t && sudo systemctl reload nginx
```
This adds `client_max_body_size 20M;` right after the `http {` line in `/etc/nginx/nginx.conf`, applying to all server blocks (both the self-signed-cert and DuckDNS ones) in one place. `nginx -t` checks the config is valid before `reload` applies it (a reload, not a restart, so it doesn't drop active connections).

Until this is done: paste-text and URL imports work fine (tiny request bodies); photo import may fail with a network/413 error for more than one or two photos, depending on their resolution.

### 12. Social media (video) recipe import -- optional, two manual steps

A fourth recipe import path transcribes the spoken audio of an Instagram Reel / TikTok / YouTube Short link (via `yt-dlp` + OpenAI's Whisper API) and runs the transcript + caption through the same Claude text-extraction path as the other import modes (see PLANNING.md's 2026-10-01 follow-up). It's **entirely optional** -- without it configured, that import tab just tells people to paste the caption as text instead, which already works today.

Two things need setting up, independently of each other (Settings → Connected services shows both):

1. **An OpenAI API key**, for Whisper transcription (Anthropic has no speech-to-text offering, so this is a second provider alongside Claude):
   - Create an account at [platform.openai.com](https://platform.openai.com), add some prepaid credit, and generate an API key.
   - Add to `backend/.env` (both the Pi and dev, see `.env.example`):
     ```
     OPENAI_API_KEY=sk-...
     ```
   - Whisper pricing is $0.006/minute of audio -- a short recipe video (under a minute, typically) costs a fraction of a cent; expect well under $1/year for a 2-person household's usage.
2. **`ffmpeg` installed on the Pi** -- `yt-dlp` shells out to it to extract just the audio track from the downloaded video. This needs `sudo` with a password (same constraint as step 11 above), so it's a manual step:
   ```bash
   sudo apt update && sudo apt install -y ffmpeg
   ```

Redeploy (or just restart Gunicorn) after adding the env var so it's picked up.

**Raise the request timeouts (done on the Pi 2026-10-11)**: an import request runs the whole pipeline synchronously -- video download (no overall cap, only a 20s per-stall socket timeout), Whisper (up to 120s), Claude (up to 60s) -- so it can take 3+ minutes. Gunicorn's default worker timeout is 30s and Nginx's default `proxy_read_timeout` is 60s, so both would cut it off first. Photo import is affected too (its Claude call alone may take up to 60s). Both raised to 300s:
```bash
# Gunicorn: add --timeout 300 to ExecStart (the service file in section 6 already includes it for new setups)
sudo sed -i 's|--workers 2 --bind|--workers 2 --timeout 300 --bind|' /etc/systemd/system/gunicorn.service
sudo systemctl daemon-reload && sudo systemctl restart gunicorn

# Nginx: global, applies to both server blocks -- run once (it inserts a line, a second run would duplicate it)
sudo sed -i '/^http {/a\    proxy_read_timeout 300s;' /etc/nginx/nginx.conf
sudo nginx -t && sudo systemctl reload nginx
```
This is only an upper bound -- nothing gets slower. With 2 Gunicorn workers, a long import occupies one while the other keeps serving the app.

Until both the API key and `ffmpeg` are set up: the Social media tab's requests fail with a clear message rather than hanging or silently doing nothing, and the other three import paths (photo/text/URL) are unaffected.

### 13. Nightly backups to the FritzBox NAS

`python manage.py backup_db` writes one `husehold-<date>_<time>.tar.gz` (a consistent SQLite snapshot via SQLite's online backup API + the whole `media/` folder) plus a small `.json` manifest into `BACKUP_DIR`, and keeps the newest `BACKUP_KEEP` (default 7).

Before writing, it checks the snapshot -- SQLite `integrity_check`, at least one user and household member, and not under half the rows of the last backup. If any check fails, or the NAS isn't mounted (detected via a `.husehold-backup-target` marker file that only exists on the share), **nothing is written or rotated** and a warning email goes out. Old backups are only ever deleted right after a new good one was written, so a run of failed nights can never eat into the last good copies. On Sundays it also sends a "Backup OK" summary (kept backups + free space), so a dead Pi -- where the job doesn't run at all -- shows up as a missing Sunday mail. A low-space warning goes out whenever the share has room for fewer than 3 more backups.

After an intentional bulk delete that trips the shrink check, run it once by hand with `--force`. `--report` sends the summary mail immediately (handy to test email).

**FritzBox side** (`http://fritz.box`):
1. Heimnetz → USB / Speicher (newer firmware: Heimnetz → Speicher (NAS)) -- enable the NAS and SMB.
2. System → FRITZ!Box-Benutzer -- add a user `pi-backup` with only "Zugang zu NAS-Inhalten" (read + write). A dedicated user means the password stored on the Pi can't touch the router's admin settings.

**Pi side:**
```bash
sudo apt install -y cifs-utils
sudo mkdir -p /mnt/fritz-nas

# Credentials file -- root-only, never committed anywhere
sudo tee /etc/husehold-backup.cred > /dev/null << 'EOF'
username=pi-backup
password=<the pi-backup password>
EOF
sudo chmod 600 /etc/husehold-backup.cred
```

Add to `/etc/fstab` (`FRITZ.NAS` is the FritzBox's default share name; `nofail` + `x-systemd.automount` mean a FritzBox that's down never blocks the Pi from booting -- the mount is retried on first access instead; `noserverino` is required -- the FritzBox doesn't keep SMB file IDs stable, so without it a file that was renamed (as `backup_db` does after copying) fails with "Stale file handle"):
```
//192.168.178.1/FRITZ.NAS /mnt/fritz-nas cifs credentials=/etc/husehold-backup.cred,uid=admin,gid=admin,file_mode=0600,dir_mode=0700,vers=3.0,noserverino,_netdev,nofail,x-systemd.automount 0 0
```
```bash
sudo systemctl daemon-reload && sudo mount /mnt/fritz-nas && ls /mnt/fritz-nas
```

Create the backup folder and marker inside whichever storage the `ls` shows (internal storage or a USB stick):
```bash
mkdir -p "/mnt/fritz-nas/<storage>/husehold-backups"
touch "/mnt/fritz-nas/<storage>/husehold-backups/.husehold-backup-target"
```

In `backend/.env`:
```
BACKUP_DIR=/mnt/fritz-nas/<storage>/husehold-backups
BACKUP_KEEP=7
BACKUP_ALERT_EMAILS=<your email>
```
Set `BACKUP_ALERT_EMAILS` explicitly rather than relying on the superuser fallback -- if the DB itself is what's broken, the fallback has nobody to look up.

Test once by hand, then schedule (`crontab -e`, 03:00 nightly):
```bash
cd ~/husehold/backend && venv/bin/python manage.py backup_db --report
```
```
0 3 * * * cd /home/admin/husehold/backend && venv/bin/python manage.py backup_db >> /home/admin/husehold/backend/backup.log 2>&1
```

**Restoring** a backup:
```bash
mkdir ~/restore && tar -xzf "/mnt/fritz-nas/<storage>/husehold-backups/husehold-<date>_<time>.tar.gz" -C ~/restore
sudo systemctl stop gunicorn
cp ~/husehold/backend/db.sqlite3 ~/db-before-restore.sqlite3   # keep the current one, just in case
cp ~/restore/db.sqlite3 ~/husehold/backend/db.sqlite3
mkdir -p ~/husehold/backend/media && cp -a ~/restore/media/. ~/husehold/backend/media/
cd ~/husehold/backend && venv/bin/python manage.py migrate     # in case the backup predates newer migrations
sudo systemctl start gunicorn
```

Moving backups to a USB stick later: plug it in, create the folder + marker there, point `BACKUP_DIR` at it. Nothing else changes.

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
Nightly automated backups to the FritzBox NAS -- see section 13. For a one-off manual copy, use SQLite's backup command rather than `cp` (a plain copy taken while Gunicorn is writing can be inconsistent):
```bash
sqlite3 ~/husehold/backend/db.sqlite3 ".backup '$HOME/db.sqlite3.backup'"
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
