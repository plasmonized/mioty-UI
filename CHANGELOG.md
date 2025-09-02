# Changelog

All notable changes to the mioty Web Console project will be documented in this file.

## [1.0.0] - 2025-09-01

### Added
- Initial release of mioty web console interface
- Complete web-based replacement for mioty-cli
- Connection management for EdgeCard devices
- Base station configuration and control
- TLS certificate management with drag-and-drop upload
- Real-time system monitoring and activity logs
- Sentinum branding with orange color scheme
- Dark mode support
- Responsive design for mobile and desktop
- Systemd service integration for RAKPiOS
- Easy installation script for one-command setup

### Features
- **Dashboard**: Complete overview of system status
- **Connection Management**: Configure network interfaces and IP settings
- **Base Station Control**: Start, stop, and configure mioty base stations
- **Certificate Upload**: Support for root_ca.cer, bstation.cer, and bstation.key files
- **Activity Logging**: Real-time logs with filtering capabilities
- **System Information**: Hardware and software status display

### Technical Details
- Built with React 18 + TypeScript + Vite
- Express.js backend with RESTful API
- Shadcn/ui components with Tailwind CSS
- In-memory storage for development (database-ready for production)
- Comprehensive form validation with Zod schemas
- Modern drag-and-drop file upload interface

### Compatibility
- Designed for RAKPiOS on Raspberry Pi
- Compatible with Miromico Miro EdgeCard EDGE-GW-MY-868
- Supports mioty communication protocol
- Node.js 18+ requirement