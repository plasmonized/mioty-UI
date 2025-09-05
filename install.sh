#!/bin/bash

# mioty Web Console Installation Script for RAKPiOS
# Author: Sentinum
# Description: Easy installation script for the mioty web console

set -e

echo "🟧 mioty Web Console Installer"
echo "=================================="
echo ""

# Check if running on compatible system
if ! command -v apt &> /dev/null; then
    echo "❌ This installer requires apt package manager (Debian/Ubuntu/RAKPiOS)"
    exit 1
fi

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   echo "❌ Please do not run this script as root. Run as regular user with sudo access."
   exit 1
fi

echo "🔍 Checking system requirements..."

# Update system packages
echo "📦 Updating system packages..."
sudo apt update

# Install Node.js if not present
if ! command -v node &> /dev/null; then
    echo "📥 Installing Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
else
    echo "✅ Node.js already installed ($(node --version))"
fi

# Check Node.js version
NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18 or higher required. Please update Node.js."
    exit 1
fi

# Install git if not present
if ! command -v git &> /dev/null; then
    echo "📥 Installing Git..."
    sudo apt-get install -y git
else
    echo "✅ Git already installed"
fi

# Install SSH if not present (needed for EdgeCard dashboard access)
if ! command -v ssh &> /dev/null; then
    echo "📥 Installing OpenSSH client..."
    sudo apt-get install -y openssh-client
else
    echo "✅ SSH already installed"
fi

# Setup SSH keys for EdgeCard access
echo "🔑 Setting up SSH keys for EdgeCard access..."
SSH_DIR="/home/$(whoami)/.ssh"
SSH_KEY="$SSH_DIR/id_rsa"

if [ ! -d "$SSH_DIR" ]; then
    mkdir -p "$SSH_DIR"
    chmod 700 "$SSH_DIR"
    echo "✅ SSH directory created"
fi

if [ ! -f "$SSH_KEY" ]; then
    echo "🔐 Generating SSH key pair..."
    ssh-keygen -t rsa -b 2048 -f "$SSH_KEY" -N "" -q
    chmod 600 "$SSH_KEY"
    chmod 644 "$SSH_KEY.pub"
    echo "✅ SSH keys generated successfully"
else
    echo "✅ SSH keys already exist"
fi

# Setup installation directory
INSTALL_DIR="/opt/mioty-web-console"
echo "📁 Setting up installation directory: $INSTALL_DIR"

# Remove existing installation if present
if [ -d "$INSTALL_DIR" ]; then
    echo "🗑️  Removing existing installation..."
    sudo rm -rf "$INSTALL_DIR"
fi

echo "⬇️  Installing mioty web console..."

# Clone the repository
echo "📥 Cloning repository..."
git clone https://github.com/plasmonized/mioty-UI.git "$INSTALL_DIR"
sudo chown -R $(whoami):$(whoami) "$INSTALL_DIR"

cd "$INSTALL_DIR"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Build the application
echo "🔨 Building application..."
npm run build

# Create systemd service
echo "⚙️  Setting up system service..."
sudo tee /etc/systemd/system/mioty-web-console.service > /dev/null <<EOF
[Unit]
Description=mioty Web Console
Documentation=https://github.com/sentinum/mioty-web-console
After=network.target

[Service]
Type=simple
User=$(whoami)
WorkingDirectory=$INSTALL_DIR
Environment=NODE_ENV=production
Environment=PORT=5000
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=10

# Output to journal
StandardOutput=journal
StandardError=inherit

# Security settings
NoNewPrivileges=yes
PrivateTmp=yes
ProtectSystem=strict
ReadWritePaths=$INSTALL_DIR

[Install]
WantedBy=multi-user.target
EOF

# Enable and start service
sudo systemctl daemon-reload
sudo systemctl enable mioty-web-console
sudo systemctl start mioty-web-console

# Get IP address
IP_ADDRESS=$(hostname -I | awk '{print $1}')

echo ""
echo "🎉 Installation completed successfully!"
echo ""
echo "🌐 Access the mioty web console at:"
echo "   Local:   http://localhost:5000"
echo "   Network: http://$IP_ADDRESS:5000"
echo ""
echo "🔧 Service management commands:"
echo "   Start:   sudo systemctl start mioty-web-console"
echo "   Stop:    sudo systemctl stop mioty-web-console"
echo "   Restart: sudo systemctl restart mioty-web-console"
echo "   Status:  sudo systemctl status mioty-web-console"
echo "   Logs:    sudo journalctl -u mioty-web-console -f"
echo ""
echo "📁 Installation directory: $INSTALL_DIR"
echo ""
echo "✅ The mioty web console is now running and will start automatically on boot."