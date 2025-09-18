# Overview

This is a Tea Factory Weighing Management System built as a full-stack web application. The system manages tea bag weighing operations with real-time monitoring, lorry queue management, and comprehensive data validation. It features a React frontend with shadcn/ui components and an Express.js backend with PostgreSQL database integration through Drizzle ORM.

The application handles the complete weighing workflow from lorry registration and tare configuration to individual tea bag weighments with tolerance validation. It includes real-time communication via WebSockets, external service integrations (MQTT for PLC communication, serial port for scale readings), and comprehensive monitoring capabilities.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture

**Framework**: React with TypeScript using Vite as the build tool
- **UI Library**: shadcn/ui components built on Radix UI primitives
- **Styling**: Tailwind CSS with custom CSS variables for theming
- **State Management**: TanStack Query for server state management
- **Routing**: Wouter for lightweight client-side routing
- **Real-time Communication**: Custom WebSocket hook for live updates

**Component Structure**: Modular design with dedicated components for queue management, weighing interface, monitoring dashboard, and settings panel. The dashboard uses a tab-based navigation system to switch between different operational views.

## Backend Architecture

**Framework**: Express.js with TypeScript
- **Database**: PostgreSQL with Drizzle ORM for type-safe database operations
- **Real-time Communication**: WebSocket server for broadcasting live updates
- **API Design**: RESTful endpoints with comprehensive error handling
- **Development Setup**: Vite middleware integration for seamless development experience

**Service Layer**: Modular service architecture with dedicated clients for MQTT communication (PLC integration), serial port communication (scale readings), API synchronization, and weight validation logic.

## Data Storage Architecture

**Database**: PostgreSQL with the following core entities:
- **Users**: Authentication and user management
- **Tare Configurations**: Daily tare weight settings per batch
- **Lorry Queue**: Vehicle queue management with status tracking
- **Weighments**: Individual tea bag weight records with validation results
- **System Settings**: Configurable application settings by category
- **System Activities**: Audit trail and activity logging

**Schema Design**: Uses Drizzle ORM with TypeScript for type-safe database operations. Includes proper foreign key relationships and timestamp tracking for audit purposes.

## Authentication & Authorization

**Authentication**: User-based authentication system with username/password credentials stored securely in the database. The system includes session management capabilities through the storage interface.

## External Service Integrations

**MQTT Client**: Handles communication with PLC systems for receiving weight data and tag IDs. Configurable topics and QoS settings for reliable industrial communication.

**Serial Client**: Manages direct communication with weighing scales through serial ports. Includes configuration for baud rate, data bits, stop bits, and parity settings.

**API Client**: Provides external API integration capabilities for data synchronization with other systems. Includes authentication methods, retry logic, and configurable sync intervals.

**Weight Validator**: Implements tolerance checking and weight source prioritization logic. Compares PLC and serial weight readings, applies configurable tolerance ranges, and determines final weight values with appropriate validation status.

# External Dependencies

## Core Framework Dependencies
- **React & TypeScript**: Frontend framework with type safety
- **Express.js**: Backend web framework
- **Vite**: Build tool and development server
- **Drizzle ORM**: Type-safe database operations
- **PostgreSQL**: Primary database (via @neondatabase/serverless)

## UI & Styling Dependencies
- **shadcn/ui**: Component library built on Radix UI primitives
- **Tailwind CSS**: Utility-first CSS framework
- **Radix UI**: Headless UI components for accessibility
- **Lucide React**: Icon library

## State Management & Data Fetching
- **TanStack Query**: Server state management and caching
- **React Hook Form**: Form state management
- **Zod**: Schema validation

## Real-time Communication
- **WebSocket (ws)**: Real-time bidirectional communication
- **Custom WebSocket hooks**: Client-side WebSocket management

## Development & Build Tools
- **Replit Integration**: Development environment plugins
- **ESBuild**: JavaScript bundler for production builds
- **PostCSS & Autoprefixer**: CSS processing

## Database & Validation
- **Drizzle Kit**: Database migrations and schema management
- **connect-pg-simple**: PostgreSQL session store
- **drizzle-zod**: Schema validation integration

The application is designed to be deployment-ready with proper environment configuration for database connections and external service integrations.