# Project Structure

## Repository Organization

### Root Level
- `readme.md` - Main project specification and requirements
- `modocaverna-docs.md` - Core knowledge base content for Modo Caverna methodology
- `base-image-prompts.md` - Detailed prompts for Capitão Caverna character image generation

### Knowledge Base Sources
- `aulas-modocaverna-cavefocus/` - PDF course materials for Cave Focus methodology
  - Module 1: Core Cave Mode concepts (Aulas 01-05)
  - Module 2: 40-day transformation protocol (Aulas 06-11)
  - Module 3: Cave Focus system (Aulas 01-16)
  - Bonus: Monetization strategies during challenge

### Application Structure (To Be Created)

```
src/
├── app/                    # Next.js app directory
│   ├── api/
│   │   ├── chat/          # Main conversation endpoint
│   │   └── v1/images/     # Image generation endpoint
│   ├── components/        # React components
│   │   ├── chat/         # Chat interface components
│   │   └── ui/           # Reusable UI components
│   └── page.tsx          # Main chat interface
├── lib/
│   ├── vectorize.ts      # Cloudflare Vectorize operations
│   ├── openai.ts         # OpenAI API integration
│   ├── r2.ts             # R2 storage operations
│   └── d1.ts             # D1 database operations
├── scripts/
│   └── ingest-docs.ts    # Knowledge base processing
└── types/
    └── index.ts          # TypeScript definitions
```

### Configuration Files
- `wrangler.toml` - Cloudflare Workers configuration
- `package.json` - Dependencies and scripts
- `next.config.js` - Next.js configuration for Cloudflare
- `tsconfig.json` - TypeScript configuration

### Database Migrations
```
migrations/
├── 0001_create_generated_images.sql
└── 0002_create_conversations.sql
```

### Key Directories Purpose

- **Knowledge Base**: All content that feeds the semantic search (docs + PDFs)
- **API Routes**: Serverless functions for chat and image generation
- **Components**: Reusable UI following the glass-ask-ai aesthetic with improved contrast
- **Scripts**: Automation for knowledge base ingestion and maintenance
- **Types**: TypeScript definitions for consistent data structures

### File Naming Conventions
- Components: PascalCase (`ChatInterface.tsx`)
- API routes: kebab-case (`/api/chat/route.ts`)
- Utilities: camelCase (`vectorizeClient.ts`)
- Constants: UPPER_SNAKE_CASE (`API_ENDPOINTS.ts`)

### Import Structure
```typescript
// External libraries
import { OpenAI } from 'openai'

// Internal utilities
import { vectorizeSearch } from '@/lib/vectorize'

// Components
import { ChatMessage } from '@/components/chat/ChatMessage'

// Types
import type { ChatResponse } from '@/types'
```