#!/bin/bash

# HUSEHOLD Deployment Script for Raspberry Pi
# This script builds and deploys the application

set -e

PROJECT_DIR="/home/pi/husehold"
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"

echo "🚀 Starting HUSEHOLD deployment..."

# Activate Python virtual environment
echo "📦 Setting up backend environment..."
cd $BACKEND_DIR
source venv/bin/activate

# Install/update Python dependencies
pip install -r requirements.txt

# Run migrations
python manage.py migrate

# Collect static files
python manage.py collectstatic --noinput

echo "🎨 Building frontend..."
cd $FRONTEND_DIR
npm install
npm run build

echo "✅ Deployment complete!"
echo "📋 Next steps:"
echo "1. Restart Gunicorn: sudo systemctl restart gunicorn"
echo "2. Reload Nginx: sudo nginx -s reload"
