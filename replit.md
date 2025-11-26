# Digital Transition Marketing - AI Chatbot System

## Overview

This is a complete AI chatbot widget system for Digital Transition Marketing's website. The project provides both an embeddable chat widget and a modern demo/admin interface. It features a futuristic design with neon accents and glass-morphism effects, powered by AI language models through HuggingFace's free inference API (Meta-Llama-3.1-8B-Instruct).

The system is designed to be:
- **100% Free to run** - Uses free-tier AI APIs
- **Easy to embed** - Drop-in widget for any website (Framer, WordPress, plain HTML)
- **Trainable** - Document upload (PDF/DOCX/TXT), website crawling, vector embeddings
- **Intelligent** - Vector-based context retrieval for smarter responses
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
- Curved animated text header

### Backend Architecture - Complete AI Brain System

**Production-Grade TypeScript Server** (`server/`) with dual-mode support (development/production)

**Core API Endpoints:**

1. **POST /api/chat** - Main chat endpoint with intelligent context retrieval
   - Input: `{ message: string, sessionId: string }`
   - Output: `{ reply: string, sessionId: string, contextUsed: boolean }`
   - Uses: Vector embeddings for similarity search to inject relevant training data into context

2. **POST /api/train/upload** - Train on documents
   - Accepts: PDF, DOCX, TXT files (up to 50MB)
   - Process: Extract text → Chunk (500 tokens with 100-token overlap) → Generate embeddings → Store in vector memory
   - Returns: Chunks created and stored count

3. **POST /api/train/crawl** - Train on websites
   - Input: `{ url, sessionId, maxPages?, maxDepth? }`
   - Process: Crawl internal links → Extract text → Chunk → Embed → Store
   - Features: Respects internal-only crawling, streaming response with progress

4. **GET /api/memory/{conversationId}** - Retrieve conversation memory
   - Returns: Last 20 memory entries with source and timestamp

5. **DELETE /api/memory/{conversationId}** - Clear conversation
   - Clears all stored vectors for a session

6. **GET /api/memory** - Debug view of all memory
   - Shows conversation count and entry statistics

7. **GET /api/health** - Health check endpoint

**AI Integration:**
- **Provider**: HuggingFace Inference API (free tier)
- **Model**: `meta-llama/Meta-Llama-3.1-8B-Instruct`
- **Context Management**: System prompt with personality + retrieved embeddings + last 10 message history
- **System Prompt**: Defines brand voice (futuristic, helpful, expert, results-driven, friendly)

**Vector Memory System** (`server/services/memory.ts`):
- In-memory vector database with cosine similarity search
- Stores embeddings alongside source metadata (file/website/memory)
- Supports conversation-scoped memory retrieval
- Fast similarity search for context injection

**Embeddings Service** (`server/services/embeddings.ts`):
- Integration with HuggingFace `sentence-transformers/all-MiniLM-L6-v2`
- Fallback to mock embeddings when API unavailable
- Text chunking with configurable overlap
- Consistent mock embedding generation for testing

**Website Crawler** (`server/services/crawler.ts`):
- Depth-first crawling with max-depth and max-pages limits
- Internal-only link following
- HTML → clean text extraction
- Visited tracking to prevent duplicates
- Rate limiting with 500ms delays

**File Parser** (`server/services/fileParser.ts`):
- PDF parsing via `pdf-parse`
- DOCX basic text extraction (reads XML structure)
- Plain text file support
- Error handling with graceful fallbacks

**Rate Limiting Middleware** (`server/middleware/rateLimit.ts`):
- Chat endpoint: 30 requests/min
- Training endpoints: 5 requests/min
- Memory endpoints: 20 requests/min
- Express rate-limit with standardized response headers

**Session Management:**
- In-memory storage implementation (`server/storage.ts`)
- Session-based conversation history with timestamps
- Prepared for database migration via storage interface abstraction

### Data Storage

**Current Implementation:**
- **Storage Interface**: `IStorage` abstraction in `server/storage.ts`
- **In-Memory Store**: `MemStorage` class with Map-based data structures for chat history
- **Vector Store**: In-memory map of embeddings indexed by similarity
- **Session Data**: Chat messages grouped by sessionId with timestamps

**Database Schema (Prepared but Optional):**
- Drizzle ORM configured for PostgreSQL
- Schema defined in `shared/schema.ts`:
  - `users` table: id, username, password (optional)
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
- `HUGGINGFACE_API_KEY` - Required for AI inference (free tier available)
- `DATABASE_URL` - Optional, for PostgreSQL connection
- `SESSION_SECRET` - Session management secret (auto-provided by Replit)
- `OPENROUTER_API_KEY` - Alternative AI provider (legacy support)

**System Prompt Construction:**
- Combines knowledge.json content with conversational guidelines
- Defines brand voice: "futuristic, helpful, expert, results-driven, friendly"
- Includes service-specific information and booking flow
- Auto-injected with vector-retrieved training data for context

### Build & Development

**Development Mode:**
- Vite dev server with HMR for React frontend
- TSX hot-reload for server changes
- Middleware mode integration between Vite and Express
- Static file serving for widget files

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
  - Embeddings: sentence-transformers/all-MiniLM-L6-v2
- **OpenRouter API** - Alternative LLM provider (legacy support)

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
- **Framer Motion** - Animation library for curved text

### Backend Libraries
- **Express.js** - Web server framework
- **Multer** - File upload handling
- **pdf-parse** - PDF text extraction
- **docx** - DOCX file parsing
- **Axios + Cheerio** - Website crawling
- **express-rate-limit** - API rate limiting
- **CORS** - Cross-origin resource sharing
- **Zod** - Runtime schema validation
- **uuid** - Session ID generation

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

## Status

✅ **Complete Backend Brain Implemented** - All features operational:
- Vector memory system for intelligent context retrieval
- Document training (PDF/DOCX/TXT upload)
- Website crawling and knowledge extraction
- Embeddings-based similarity search
- Rate limiting protection
- Session-based conversation management
- HuggingFace AI integration

✅ **Frontend Widget** - Fully functional with neon design, glass-morphism, curved animated text

✅ **Production Ready** - TypeScript strict mode, error handling, input validation, API security
