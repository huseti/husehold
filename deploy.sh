#!/bin/bash

# HUSEHOLD Backend Deployment Script — runs ON the Raspberry Pi
# Called remotely by deploy.ps1 (which handles the frontend build on the laptop)

set -e

BACKEND_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/backend" && pwd)"

echo "Deploying backend..."
cd "$BACKEND_DIR"
source venv/bin/activate

pip install -r requirements.txt
python manage.py migrate
python manage.py collectstatic --noinput

echo "Restarting gunicorn..."
sudo systemctl restart gunicorn

echo "Backend deployment complete."
