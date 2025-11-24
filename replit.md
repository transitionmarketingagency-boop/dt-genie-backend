# Digital Transition Marketing - AI Chatbot System

## Overview

This is a complete AI chatbot widget system for Digital Transition Marketing's website. The project provides both an embeddable chat widget and a modern demo/admin interface. It features a futuristic design with neon accents and glass-morphism effects, powered by AI language models through HuggingFace's free inference API (Meta-Llama-3.1-8B-Instruct).

The system is designed to be:
- **100% Free to run** - Uses free-tier AI APIs
- **Easy to embed** - Drop-in widget for any website (Framer, WordPress, plain HTML)
- **Customizable** - Train the bot with business-specific knowledge via JSON
- **Production-ready** - Full TypeScript stack with modern tooling

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Dual Frontend Approach:**
1. **Legacy Widget** (`public/widget.js` + `public/widget.css`) - Vanilla JavaScript chatbot widget with neon/futuristic design theme, designed for embedding on external websites
2. **Modern React Application** (`client/src/`) - TypeScript + React + Vite application using shadcn/ui components for demo pages and management interface

**UI Framework:**
- **Component Library**: Radix UI primitives with shadcn/ui styling system
- **Styling**: Tailwind CSS with custom design tokens for glass-morphism and neon effects
- **Design System**: Custom color palette with primary blue (#3B82F6), neon accents, and dark theme support
- **State Management**: React hooks and TanStack Query for server state
- **Routing**: Wouter for lightweight client-side routing

**Widget Design:**
- Floating chat button (60px circle, bottom-right positioning)
- Slide-up chat panel (380px width, 600px max height, 16px border radius)
- Message bubbles with user/assistant differentiation
- Typing indicators with animated dots
- Responsive design for mobile/tablet/desktop

### Backend Architecture

**Dual Server Implementation:**
1. **Legacy Express Server** (`server.js`) - Simple Node.js/Express backend for the standalone widget
2. **Modern TypeScript Server** (`server/`) - Production-grade Express server with development/production modes

**API Design:**
- **Primary Endpoint**: `POST /api/chat`
  - Accepts: `{ message: string, sessionId: string }`
  - Returns: `{ reply: string, sessionId: string }`
  - Maintains conversation context via session-based message history

**AI Integration:**
- **Provider**: HuggingFace Inference API (free tier)
- **Model**: `meta-llama/Meta-Llama-3.1-8B-Instruct`
- **Context Management**: System prompt with business knowledge + last 10 messages for context window
- **Training Data**: Loaded from `knowledge.json` and injected into system prompt

**Session Management:**
- In-memory storage implementation (`server/storage.ts`)
- Session-based conversation history
- Prepared for database migration via storage interface abstraction

### Data Storage

**Current Implementation:**
- **Storage Interface**: `IStorage` abstraction in `server/storage.ts`
- **In-Memory Store**: `MemStorage` class with Map-based data structures
- **Session Data**: Chat messages grouped by sessionId with timestamps

**Database Schema (Prepared but Optional):**
- Drizzle ORM configured for PostgreSQL
- Schema defined in `shared/schema.ts`:
  - `users` table: id, username, password
  - `chat_messages` table: id, sessionId, role, content, timestamp
- Migration support via drizzle-kit

**Design Decision**: Started with in-memory storage for simplicity and zero-setup deployment. Database connection is optional - the storage interface allows swapping implementations without changing business logic.

### Configuration & Knowledge Base

**Training System:**
- `knowledge.json` - Business knowledge base with:
  - Business information and services
  - Industry focus areas
  - Contact/booking instructions
  - System personality definition

**Environment Configuration:**
- `HUGGINGFACE_API_KEY` - Required for AI inference
- `DATABASE_URL` - Optional, for PostgreSQL connection
- `OPENROUTER_API_KEY` - Alternative AI provider (legacy)

**System Prompt Construction:**
- Combines knowledge.json content with conversational guidelines
- Defines brand voice: "futuristic, helpful, expert, results-driven, friendly"
- Includes service-specific information and booking flow

### Build & Development

**Development Mode:**
- Vite dev server with HMR for React frontend
- TSX hot-reload for server changes
- Middleware mode integration between Vite and Express

**Production Build:**
- Vite builds React app to `dist/public`
- esbuild bundles TypeScript server to `dist/index.js`
- Static file serving from compiled assets
- Single production artifact

**Type Safety:**
- Shared types in `shared/schema.ts` using Zod schemas
- Drizzle-Zod integration for runtime validation
- TypeScript strict mode enabled
- Path aliases for clean imports (@/, @shared/)

## External Dependencies

### AI Services
- **HuggingFace Inference API** - Primary LLM provider (free tier)
  - Model: meta-llama/Meta-Llama-3.1-8B-Instruct
  - Endpoint: `https://api-inference.huggingface.co/models/`
- **OpenRouter API** - Alternative LLM provider (legacy support)
  - Uses free tier with Meta-Llama model

### Database (Optional)
- **PostgreSQL** - Via Neon serverless (@neondatabase/serverless)
- **Drizzle ORM** - Type-safe database toolkit
- **Connection Pooling** - Built into Neon serverless driver

### Frontend Libraries
- **React 18** - UI framework
- **Radix UI** - Headless component primitives (30+ components imported)
- **TanStack Query** - Server state management
- **Tailwind CSS** - Utility-first styling
- **Wouter** - Lightweight routing
- **class-variance-authority** - Component variant management
- **Embla Carousel** - Touch-friendly carousels

### Backend Libraries
- **Express.js** - Web server framework
- **CORS** - Cross-origin resource sharing
- **Zod** - Runtime schema validation
- **date-fns** - Date manipulation utilities

### Development Tools
- **Vite** - Frontend build tool and dev server
- **esbuild** - Fast JavaScript bundler
- **TypeScript** - Type safety and tooling
- **tsx** - TypeScript execution for Node.js
- **Drizzle Kit** - Database migrations

### Third-Party Integrations
- **Calendly** - Appointment booking (referenced in knowledge base)
  - Link: `https://calendly.com/digitaltransition`
  - Integrated into chatbot conversation flow for consultation bookings

### Replit-Specific
- **@replit/vite-plugin-runtime-error-modal** - Error overlay
- **@replit/vite-plugin-cartographer** - Code mapping (dev only)
- **@replit/vite-plugin-dev-banner** - Development banner (dev only)