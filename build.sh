#!/usr/bin/env bash
# FutureAssist AI - Render.com Build Script
# This script is executed by Render during deployment.
set -o errexit

echo "=== FutureAssist AI Build ==="

# 1. Install Python dependencies
echo ">>> Installing Python dependencies..."
pip install --upgrade pip
pip install -r api/requirements.txt

# 2. Build React frontend
echo ">>> Building React frontend..."
cd frontend
npm install
npm run build
cd ..

# 3. Copy built frontend to static/ directory (served by FastAPI)
echo ">>> Copying frontend build to static/..."
rm -rf static
cp -r frontend/dist static

echo "=== Build complete ==="
