# Ask the Captain - Modo Caverna AI Assistant

The "Ask the Captain" platform is a strategic refuge and mental battleground for individuals committed to escaping mediocity. It features an AI assistant embodying the "Capitão Caverna" persona - a direct, uncompromising mentor who guides users through action and discipline.

## Architecture

This application is built entirely on the Cloudflare developer platform:

- **Runtime**: Cloudflare Workers
- **Web Framework**: Next.js with OpenNext adapter
- **Database**: Cloudflare D1 (metadata and conversations)
- **Vector Search**: Cloudflare Vectorize (semantic search)
- **Storage**: Cloudflare R2 (generated images)
- **AI Services**: OpenAI API (embeddings, chat, image generation)

## Setup Instructions

### 1. Environment Configuration

Copy the environment template:
```bash
cp .env.example .dev.vars
```

Edit `.dev.vars` and add your OpenAI API key:
```
OPENAI_API_KEY=your-openai-api-key-here
```

### 2. Create Cloudflare Resources

Create the required Cloudflare resources:

```bash
# Create D1 database
npm run db:create

# Create Vectorize index
npm run vectorize:create

# Create R2 bucket
npm run r2:create
```

After creating these resources, update `wrangler.jsonc` with the actual IDs returned by the commands above.

### 3. Database Setup

Run database migrations:

```bash
# For local development
npm run db:migrate:local

# For production
npm run db:migrate:remote
```

### 4. Knowledge Base Ingestion

Process and ingest the Modo Caverna knowledge base:

```bash
npm run ingest-docs
```

### 5. Development

Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the application.

### 6. Preview with Cloudflare Workers

Test with the Cloudflare Workers runtime:

```bash
npm run preview
```

Open [http://localhost:8788](http://localhost:8788) to preview with Cloudflare Workers.

## Project Structure

```
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   │   ├── chat/         # Main conversation endpoint
│   │   └── v1/images/    # Image generation endpoint
│   ├── components/       # React components
│   └── page.tsx         # Main chat interface
├── lib/                  # Utility libraries
│   ├── d1.ts            # D1 database operations
│   ├── vectorize.ts     # Vectorize search operations
│   ├── r2.ts            # R2 storage operations
│   └── openai.ts        # OpenAI API integration
├── types/               # TypeScript definitions
├── scripts/             # Automation scripts
│   └── ingest-docs.ts   # Knowledge base ingestion
├── migrations/          # Database migrations
└── wrangler.jsonc       # Cloudflare Workers configuration
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview with Cloudflare Workers
- `npm run deploy` - Deploy to Cloudflare
- `npm run ingest-docs` - Process knowledge base documents
- `npm run db:migrate:local` - Run database migrations locally
- `npm run db:migrate:remote` - Run database migrations in production
- `npm run cf-typegen` - Generate Cloudflare types

## Core Features

### 1. Semantic Search
High-performance semantic search over the Modo Caverna knowledge base using Cloudflare Vectorize and OpenAI embeddings.

### 2. Dynamic Image Generation
Context-aware image generation of Capitão Caverna using DALL-E 3, with images stored in Cloudflare R2.

### 3. Capitão Caverna Persona
Consistent AI persona embodying the direct, action-oriented mentorship style of the Modo Caverna methodology.

### 4. Glass Morphism UI
Immersive chat interface with glass morphism effects, optimized for focus and accessibility.

## Deployment

Deploy to Cloudflare Pages:

```bash
npm run deploy
```

Or use the [Cloudflare Pages GitHub integration](https://developers.cloudflare.com/pages/get-started/git-integration/) for automatic deployments.

## Philosophy

**Purpose > Focus > Progress**

The platform embodies the core philosophy of Cave Mode, providing users with direct, actionable guidance based on the extensive Modo Caverna knowledge base.