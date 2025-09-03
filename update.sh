#!/bin/bash

# mioty Web Console Update Script for RAKPiOS
# Author: Sentinum
# Description: Updates the mioty web console to the latest Git version

set -e

echo "🔄 mioty Web Console Updater"
echo "============================="
echo ""

# Configuration
INSTALL_DIR="/opt/mioty-web-console"
SERVICE_NAME="mioty-web-console"

# Check if running as regular user with sudo access
if [[ $EUID -eq 0 ]]; then
   echo "❌ Please do not run this script as root. Run as regular user with sudo access."
   exit 1
fi

# Check if installation exists
if [ ! -d "$INSTALL_DIR" ]; then
    echo "❌ Installation not found at $INSTALL_DIR"
    echo "Please run install.sh first to install the application."
    exit 1
fi

echo "📁 Updating from directory: $INSTALL_DIR"

# Stop the service
echo "⏹️  Stopping mioty web console service..."
sudo systemctl stop $SERVICE_NAME

# Navigate to installation directory
cd "$INSTALL_DIR"

# Backup current version (optional)
echo "💾 Creating backup of current version..."
BACKUP_DIR="${INSTALL_DIR}_backup_$(date +%Y%m%d_%H%M%S)"
sudo cp -r "$INSTALL_DIR" "$BACKUP_DIR"
echo "✅ Backup created at: $BACKUP_DIR"

# Update from Git
echo "⬇️  Fetching latest version from Git..."
git fetch origin
git reset --hard origin/main

# Check Node.js version
NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18 or higher required. Please update Node.js."
    exit 1
fi

# Install/update dependencies
echo "📦 Installing dependencies..."
npm ci

# Build the application
echo "🔨 Building application..."
npm run build

# Update file permissions
echo "🔐 Setting file permissions..."
sudo chown -R $(whoami):$(whoami) "$INSTALL_DIR"

# Start the service
echo "▶️  Starting mioty web console service..."
sudo systemctl start $SERVICE_NAME

# Check if service is running
sleep 3
if sudo systemctl is-active --quiet $SERVICE_NAME; then
    echo ""
    echo "🎉 Update completed successfully!"
    echo ""
    
    # Get IP address
    IP_ADDRESS=$(hostname -I | awk '{print $1}')
    
    echo "🌐 mioty web console is now running:"
    echo "   Local:   http://localhost:5000"
    echo "   Network: http://$IP_ADDRESS:5000"
    echo ""
    echo "🔧 Service management commands:"
    echo "   Status:  sudo systemctl status mioty-web-console"
    echo "   Logs:    sudo journalctl -u mioty-web-console -f"
    echo ""
    echo "📁 Installation directory: $INSTALL_DIR"
    echo "💾 Backup available at: $BACKUP_DIR"
    echo ""
    echo "✅ mioty web console has been updated and is running."
else
    echo ""
    echo "❌ Service failed to start. Check logs with:"
    echo "   sudo journalctl -u mioty-web-console -f"
    echo ""
    echo "💾 You can restore from backup if needed:"
    echo "   sudo systemctl stop mioty-web-console"
    echo "   sudo rm -rf $INSTALL_DIR"
    echo "   sudo mv $BACKUP_DIR $INSTALL_DIR"
    echo "   sudo systemctl start mioty-web-console"
    exit 1
fi