# Overview

This is a mioty wireless communication system dashboard built as a full-stack web application. The project provides a management interface for EdgeCard communication devices, allowing users to configure base station settings, manage TLS certificates, monitor connection status, and view system activity logs. The application is designed to simplify the setup and management of mioty-based IoT communication infrastructure.

# Recent Changes

## Real Data Integration & BusyBox Compatibility (January 2025)
- **Real Data Implementation**: Successfully replaced all mock data with live EdgeCard data
- **BusyBox Compatibility**: Fixed SSH commands for EdgeCard's BusyBox v1.31.1 environment:
  - Changed `uptime -p` to `uptime` (BusyBox doesn't support -p flag)
  - Simplified memory usage command for BusyBox compatibility  
  - Added process detection fallback using `ps` when systemctl unavailable
- **Timeout Optimization**: Increased SSH timeouts from 15 seconds to 5 minutes (300s) for production stability
- **Clean Logging**: Removed SSH verbose flag to eliminate debug noise in activity logs
- **Periodic Updates**: 30-second automatic data refresh from EdgeCard
- **Real-time Status**: Live base station status, configuration, and system information

## Dashboard SSH Tunnel Implementation (January 2025)
- **Dashboard Button Fixed**: SSH tunnel creation now works with proper original mioty-cli compatibility
- **SSH Configuration**: Implemented exact SSH options from original mioty-cli:
  - `ConnectTimeout=10`
  - `HostKeyAlgorithms=+ssh-rsa` 
  - `IdentityFile=/home/rak/.ssh/id_rsa` (uses automatically generated SSH keys)
  - `StrictHostKeyChecking=no` and `UserKnownHostsFile=/dev/null` for automatic connection
- **SSH Tunnel**: Creates tunnel on `0.0.0.0:8888` forwarding to EdgeCard `localhost:8080`
- **Error Handling**: Comprehensive SSH process monitoring with clean error logging
- **Port Management**: Automatic cleanup of existing SSH tunnels before creating new ones
- **Automatic SSH Setup**: Installation and update scripts now automatically:
  - Install OpenSSH client if needed
  - Create SSH directory with proper permissions (700)
  - Generate RSA key pair (2048-bit) for EdgeCard authentication
  - Set correct file permissions (600 for private key, 644 for public key)
- **Standalone Operation**: Web console is fully independent - no need for original mioty-cli installation

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: React 18 with TypeScript, built using Vite for fast development and optimized production builds
- **UI Framework**: Shadcn/ui components built on Radix UI primitives with Tailwind CSS for styling
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack Query (React Query) for server state management and data fetching
- **Forms**: React Hook Form with Zod validation for type-safe form handling

## Backend Architecture
- **Runtime**: Node.js with Express.js server framework
- **Language**: TypeScript with ES modules
- **Development**: tsx for development server with hot reloading
- **Production**: esbuild for fast bundling and compilation

## Data Storage Solutions
- **ORM**: Drizzle ORM for type-safe database operations
- **Database**: PostgreSQL with Neon serverless database provider
- **Schema**: Shared TypeScript schema definitions with Zod validation
- **Storage Strategy**: Currently using in-memory storage (MemStorage) for development, with database schema ready for production deployment

## API Design
- **Pattern**: RESTful API with JSON request/response format
- **Endpoints**: Organized around resource-based URLs (/api/connection, /api/config, /api/certificates, etc.)
- **File Uploads**: Multer middleware for certificate file handling
- **Error Handling**: Centralized error handling with consistent JSON error responses
- **Logging**: Custom request/response logging with performance timing

## Component Architecture
- **Design System**: Modular UI components with consistent theming through CSS custom properties
- **Layout**: Dashboard-based layout with responsive design for mobile and desktop
- **Data Flow**: React Query for API state management with optimistic updates and automatic refetching
- **Form Handling**: Controlled components with validation feedback and loading states

## Development Workflow
- **Build System**: Vite for frontend bundling with React plugin and TypeScript support
- **Hot Reloading**: Development server with HMR for both frontend and backend changes
- **Path Aliases**: Configured import aliases (@, @shared, @assets) for clean imports
- **Code Quality**: TypeScript strict mode with comprehensive type checking

# External Dependencies

## Core Libraries
- **@neondatabase/serverless**: Neon serverless PostgreSQL database driver for cloud-native database operations
- **drizzle-orm & drizzle-kit**: Type-safe ORM with PostgreSQL dialect and migration tools
- **@tanstack/react-query**: Server state management for data fetching, caching, and synchronization

## UI Framework
- **@radix-ui/***: Complete suite of accessible UI primitives (dialog, select, accordion, etc.)
- **tailwindcss**: Utility-first CSS framework for responsive design
- **class-variance-authority**: Utility for creating variant-based component APIs
- **lucide-react**: Feather-style icon library for consistent iconography

## Form Management
- **react-hook-form**: Performant forms library with minimal re-renders
- **@hookform/resolvers**: Validation resolvers for React Hook Form
- **zod**: TypeScript-first schema validation library

## Development Tools
- **tsx**: TypeScript execution environment for Node.js development
- **esbuild**: Fast JavaScript bundler for production builds
- **vite**: Frontend build tool with fast HMR and optimized production builds
- **@replit/vite-plugin-***: Replit-specific development enhancements

## Additional Utilities
- **wouter**: Minimalist routing library for React applications
- **date-fns**: Modern JavaScript date utility library
- **clsx & tailwind-merge**: Utility functions for conditional CSS classes
- **multer**: Middleware for handling multipart/form-data (file uploads)