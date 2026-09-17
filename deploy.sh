#!/bin/bash

# HUSEHOLD Backend Deployment Script — runs ON the Raspberry Pi
# Called remotely by deploy.ps1 (which handles the frontend build on the laptop)

set -e

BACKEND_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/backend" && pwd)"
FRONTEND_DIST_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/frontend/dist" && pwd)"

# scp recreates dist/ from scratch on every deploy with restrictive default
# permissions. nginx runs as www-data, which is a member of the admin group
# on this Pi — so the *group* permission bits apply to it (not "other"), even
# though it's not the file owner. Without this, nginx gets 403s on dist/.
echo "Fixing frontend dist/ permissions for nginx (www-data)..."
chmod -R g+rX "$FRONTEND_DIST_DIR"

echo "Deploying backend..."
cd "$BACKEND_DIR"
source venv/bin/activate

pip install -r requirements.txt
python manage.py migrate
python manage.py collectstatic --noinput

echo "Restarting gunicorn..."
sudo systemctl restart gunicorn

echo "Backend deployment complete."
