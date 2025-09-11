# Overview

This is a Schulte Game web application - a cognitive training exercise where players must click on letters or numbers in alphabetical/numerical order within a grid. The game features multiple difficulty levels with varying grid sizes and character sets, performance tracking, and leaderboards. It's built as a full-stack application with a React frontend and Express.js backend.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: React with TypeScript using Vite as the build tool
- **UI Library**: Radix UI components with shadcn/ui styling system
- **Styling**: Tailwind CSS with CSS variables for theming
- **State Management**: React Query (@tanstack/react-query) for server state and React hooks for local state
- **Routing**: Wouter for client-side routing
- **Form Handling**: React Hook Form with Zod validation

## Backend Architecture
- **Framework**: Express.js with TypeScript
- **API Structure**: RESTful API with routes for game results management
- **Data Storage**: In-memory storage (MemStorage class) with interface for future database integration
- **Session Management**: Express sessions with PostgreSQL session store configuration
- **Development**: Hot reload with Vite integration in development mode

## Game Logic
- **Game States**: Ready, Playing, Paused, Completed states
- **Difficulty Levels**: Beginner (5x5), Intermediate (10x10), Advanced (15x15), Expert (25x25)
- **Character Sets**: Dynamically generated based on difficulty level
- **Performance Tracking**: Completion time, accuracy, and performance ratings
- **Progress Persistence**: Game results saved to backend with leaderboard functionality

## Data Schema
- **Users Table**: ID, username, password for future authentication
- **Game Results Table**: ID, completion time, difficulty, grid size, user ID, creation timestamp
- **Validation**: Zod schemas for type-safe data validation between frontend and backend

## External Dependencies

### Core Technologies
- **Database**: PostgreSQL with Drizzle ORM for schema management
- **Database Provider**: Neon Database (@neondatabase/serverless)
- **Session Storage**: connect-pg-simple for PostgreSQL session management

### Frontend Libraries
- **UI Components**: Complete Radix UI component library (dialogs, buttons, forms, etc.)
- **Styling**: class-variance-authority for component variants, clsx for conditional classes
- **Icons**: Lucide React icon library
- **Date Handling**: date-fns for date formatting and manipulation
- **Carousel**: Embla Carousel for image/content carousels
- **Command Palette**: cmdk for command menu functionality

### Development Tools
- **Build Tools**: Vite with React plugin and TypeScript support
- **Code Quality**: ESBuild for production bundling
- **Development Experience**: Replit-specific plugins for runtime error handling and cartographer integration
- **Database Management**: Drizzle Kit for database migrations and schema management

### Styling and Theming
- **CSS Framework**: Tailwind CSS with PostCSS and Autoprefixer
- **Fonts**: Google Fonts integration (Architects Daughter, DM Sans, Fira Code, Geist Mono)
- **Theme System**: CSS custom properties for light/dark theme support
- **Component Styling**: Consistent design system with radius, color, and spacing variables