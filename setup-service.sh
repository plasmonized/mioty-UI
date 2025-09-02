#!/bin/bash

# mioty Web Console Service Setup Script
# Sets up systemd service for automatic startup

set -e

INSTALL_DIR=$(pwd)
SERVICE_NAME="mioty-web-console"

echo "🔧 Setting up mioty web console as system service..."

# Create systemd service file
sudo tee /etc/systemd/system/$SERVICE_NAME.service > /dev/null <<EOF
[Unit]
Description=mioty Web Console - Web interface for mioty base station management
Documentation=https://github.com/sentinum/mioty-web-console
After=network.target

[Service]
Type=simple
User=$(whoami)
Group=$(whoami)
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

# Reload systemd and enable service
sudo systemctl daemon-reload
sudo systemctl enable $SERVICE_NAME

echo "✅ Service created and enabled"
echo ""
echo "🎮 Service commands:"
echo "   Start:   sudo systemctl start $SERVICE_NAME"
echo "   Stop:    sudo systemctl stop $SERVICE_NAME" 
echo "   Restart: sudo systemctl restart $SERVICE_NAME"
echo "   Status:  sudo systemctl status $SERVICE_NAME"
echo "   Logs:    sudo journalctl -u $SERVICE_NAME -f"
echo ""
echo "🚀 To start the service now: sudo systemctl start $SERVICE_NAME"