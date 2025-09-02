# mioty Web Console

A modern web interface for managing Miromico Miro EdgeCard mioty base stations on RAKPiOS. This application provides an intuitive dashboard to replace the command-line mioty-cli tool with a user-friendly web interface.

## Features

- 🌐 **Web-based Dashboard** - Access from any device on your network
- 🔗 **Connection Management** - Configure and monitor EdgeCard connections
- ⚙️ **Base Station Control** - Start, stop, and configure mioty base stations
- 🔐 **Certificate Management** - Upload and manage TLS certificates with drag-and-drop
- 📊 **Real-time Monitoring** - View system status and activity logs
- 🎯 **Sentinum Branding** - Professional orange-themed interface
- 🌙 **Dark Mode Support** - Toggle between light and dark themes

## System Requirements

- **Operating System**: RAKPiOS (Debian-based)
- **Hardware**: Raspberry Pi with Miromico Miro EdgeCard
- **Node.js**: Version 18 or higher
- **Memory**: Minimum 512MB RAM
- **Network**: Ethernet or WiFi connection

## Quick Installation

### One-Command Install
```bash
curl -fsSL https://raw.githubusercontent.com/[your-username]/mioty-web-console/main/install.sh | bash
```

### Manual Installation

1. **Install Prerequisites**
   ```bash
   # Update system
   sudo apt update && sudo apt upgrade -y
   
   # Install Node.js 20
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs git
   ```

2. **Clone and Install**
   ```bash
   # Clone the repository
   git clone https://github.com/[your-username]/mioty-web-console.git
   cd mioty-web-console
   
   # Install dependencies
   npm install
   
   # Build the application
   npm run build
   
   # Start the application
   npm start
   ```

3. **Set up as System Service** (Optional)
   ```bash
   # Run the included setup script
   sudo ./setup-service.sh
   ```

## Usage

### Accessing the Interface
Once installed, access the web console at:
- **Local**: http://localhost:5000
- **Network**: http://[your-pi-ip]:5000

### Managing Your Base Station

1. **Connection Setup**
   - Configure network interface (default: eth1)
   - Set IP addresses for your network setup
   - Test connection to EdgeCard

2. **Base Station Configuration**
   - Set unique base station ID
   - Configure service center connection (default: eu3.loriot.io:727)
   - Choose appropriate regional profile

3. **Certificate Management**
   - Upload TLS certificates (root_ca.cer, bstation.cer, bstation.key)
   - Drag and drop files or use file browser
   - View certificate status and validation

4. **System Monitoring**
   - Real-time base station status
   - Activity logs with filtering
   - System information display

## Service Management

Control the mioty web console service:

```bash
# Start the service
sudo systemctl start mioty-web-console

# Stop the service
sudo systemctl stop mioty-web-console

# Restart the service
sudo systemctl restart mioty-web-console

# Check status
sudo systemctl status mioty-web-console

# View logs
sudo journalctl -u mioty-web-console -f
```

## Configuration

The application uses the same configuration approach as mioty-cli:
- Default EdgeCard model: EDGE-GW-MY-868
- Default service center: eu3.loriot.io:727
- Default network interface: eth1
- Default IP range: 172.30.1.x

All settings can be modified through the web interface.

## Troubleshooting

### Port Already in Use
If port 5000 is occupied, you can change it by setting the PORT environment variable:
```bash
PORT=8080 npm start
```

### Permission Issues
Ensure the service user has proper permissions:
```bash
sudo chown -R $(whoami):$(whoami) /opt/mioty-web-console
```

### Network Access Issues
Check firewall settings:
```bash
# Allow port 5000 through firewall
sudo ufw allow 5000
```

## Development

### Local Development
```bash
# Start development server with hot reloading
npm run dev
```

### Build for Production
```bash
# Create production build
npm run build

# Start production server
npm start
```

## Support

For issues and support:
- Check the activity logs in the web interface
- Review system service logs: `sudo journalctl -u mioty-web-console -f`
- Ensure EdgeCard is properly connected and configured

## License

MIT License - See LICENSE file for details.

---

**Sentinum mioty Web Console** - Simplifying mioty base station management on RAKPiOS