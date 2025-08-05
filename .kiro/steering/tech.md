# Technical Architecture

## Edge-First Cloudflare Stack

**Architecture Philosophy**: Edge-First. The entire stack must be built using the Cloudflare developer platform to minimize latency and unify the operational toolchain.

### Core Technologies

- **Deployment Target**: Cloudflare Workers
- **Web Framework**: Next.js (utilizing create-cloudflare CLI with OpenNext adapter)
- **Relational Database**: Cloudflare D1 (metadata for generated images, future conversation histories)
- **Vector Database**: Cloudflare Vectorize (critical for high-performance semantic search)
- **Object Storage**: Cloudflare R2 (generated PNG images of Capitão Caverna)
- **LLM**: OpenAI API (existing OpenAI API key)

### Authentication
- **MVP**: None (public access)
- **Future**: included Google credentials. Design with nullable user_id fields for easy authentication integration


### Key API Endpoints

#### POST /api/chat
Core conversation endpoint:
1. Receive user query
2. Generate embedding for query
3. Semantic search via Vectorize
4. Construct system prompt with persona + context
5. Generate response via OpenAI
6. Return text response

#### POST /api/v1/images/generate
Dynamic image generation:
1. Analyze response content/tone
2. Select parameters from base prompts
3. Generate image via DALL-E 3
4. Store in R2 bucket
5. Save metadata in D1
6. Return public URL

### Database Schema (D1)

```sql
-- Generated Images
CREATE TABLE GeneratedImages (
  image_id TEXT PRIMARY KEY,
  r2_object_key TEXT NOT NULL,
  prompt_parameters TEXT, -- JSON
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Future: Conversations (with nullable user_id)
CREATE TABLE Conversations (
  id TEXT PRIMARY KEY,
  user_id TEXT, -- nullable for MVP
  message TEXT,
  response TEXT,
  image_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (image_id) REFERENCES GeneratedImages(image_id)
);
```

### Knowledge Base Processing
- Automated script for document ingestion (.txt, .md, PDFs)
- Chunk documents into meaningful segments
- Generate embeddings via OpenAI
- Store in Vectorize index
- Initial sources: modocaverna-docs.md, aulas-modocaverna-cavefocus folder

### Common Commands

```bash
# Development
npm run dev

# Build for Cloudflare
npm run build

# Deploy to Cloudflare Workers
npm run deploy

# Knowledge base ingestion
npm run ingest-docs

# Database migrations
npx wrangler d1 migrations apply --local
npx wrangler d1 migrations apply --remote
```

### Environment Variables
- `OPENAI_API_KEY`
- `CLOUDFLARE_ACCOUNT_ID`
- `D1_DATABASE_ID`
- `VECTORIZE_INDEX_ID`
- `R2_BUCKET_NAME`