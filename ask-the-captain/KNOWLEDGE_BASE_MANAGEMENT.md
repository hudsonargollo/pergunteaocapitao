# Knowledge Base Management Guide

This guide covers the management, maintenance, and optimization of the Ask the Captain knowledge base system.

## Overview

The knowledge base system processes documents from the Modo Caverna methodology and creates searchable embeddings for the AI assistant. It includes tools for ingestion, validation, monitoring, and optimization.

## Architecture

```
Knowledge Base System
├── Source Documents
│   ├── modocaverna-docs.md (Core methodology)
│   └── aulas-modocaverna-cavefocus/ (PDF course materials)
├── Processing Pipeline
│   ├── Document Processing (chunking, cleaning)
│   ├── Embedding Generation (OpenAI API)
│   └── Vector Storage (Cloudflare Vectorize)
├── Management Tools
│   ├── Ingestion Scripts
│   ├── Validation Tools
│   ├── Quality Testing
│   └── Monitoring Dashboard
└── Storage
    ├── Local Development (JSON files)
    └── Production (Cloudflare D1 + Vectorize)
```

## Quick Start

### Initial Setup

1. **Install Dependencies**
   ```bash
   cd ask-the-captain
   npm install
   ```

2. **Set Environment Variables**
   ```bash
   export OPENAI_API_KEY="your-openai-api-key"
   # Optional for production:
   # export VECTORIZE_INDEX_ID="your-vectorize-index-id"
   ```

3. **Run Initial Ingestion**
   ```bash
   npm run ingest-docs
   ```

4. **Validate Knowledge Base**
   ```bash
   npx tsx scripts/validate-knowledge-base.ts
   ```

## Management Commands

### Knowledge Base Management

The main management script provides comprehensive tools:

```bash
# Full ingestion from source documents
npx tsx scripts/manage-knowledge-base.ts ingest --verbose

# Validate knowledge base integrity
npx tsx scripts/manage-knowledge-base.ts validate

# Incremental update of outdated sources
npx tsx scripts/manage-knowledge-base.ts update

# Create backup
npx tsx scripts/manage-knowledge-base.ts backup

# Show current status
npx tsx scripts/manage-knowledge-base.ts status

# Show help
npx tsx scripts/manage-knowledge-base.ts help
```

### Search Quality Testing

Test and optimize search functionality:

```bash
# Run comprehensive search quality tests
npx tsx scripts/test-search-quality.ts

# View latest quality report
cat data/search-tests/latest-report.json
```

### Available Scripts

Add these to your `package.json` scripts section:

```json
{
  "scripts": {
    "ingest-docs": "npx tsx scripts/ingest-docs.ts",
    "validate-kb": "npx tsx scripts/validate-knowledge-base.ts",
    "kb:manage": "npx tsx scripts/manage-knowledge-base.ts",
    "kb:test-quality": "npx tsx scripts/test-search-quality.ts",
    "kb:status": "npx tsx scripts/manage-knowledge-base.ts status"
  }
}
```

## Document Processing

### Supported Formats

- **Markdown (.md)**: Primary documentation format
- **PDF (.pdf)**: Course materials and lessons

### Chunking Strategy

Documents are processed using semantic chunking:

- **Chunk Size**: 800 tokens (~600-1000 characters)
- **Overlap**: 100 tokens between chunks
- **Structure Preservation**: Headers and sections maintained
- **Quality Filtering**: Short or low-quality chunks removed

### Metadata Extraction

Each chunk includes:

```typescript
interface DocumentChunk {
  id: string              // Unique identifier
  content: string         // Processed text content
  source: string          // Source document name
  metadata: {
    title?: string        // Section title
    section?: string      // Section identifier
    module?: string       // Course module (for PDFs)
    lesson?: string       // Lesson number (for PDFs)
    type?: string         // Document type
  }
}
```

## Embedding Generation

### Configuration

- **Model**: OpenAI text-embedding-3-small (1536 dimensions)
- **Batch Size**: 100 chunks per request
- **Rate Limiting**: 50 requests/minute, 150k tokens/minute
- **Retry Logic**: 3 attempts with exponential backoff

### Quality Validation

Embeddings are validated for:
- Correct dimensions (1536)
- Numerical validity (no NaN values)
- Content association
- Token count accuracy

## Search Quality Testing

### Test Categories

1. **Basic Queries**: Simple, direct questions
2. **Complex Queries**: Multi-concept questions
3. **Edge Cases**: Unusual or challenging queries

### Quality Metrics

- **Semantic Similarity**: Average cosine similarity score
- **Source Relevance**: Relevance of returned sources
- **Keyword Coverage**: Presence of expected keywords
- **Response Time**: Query processing speed
- **Result Diversity**: Variety in sources and content

### Quality Thresholds

- Minimum similarity: 60%
- Source relevance: 50%
- Keyword coverage: 50%
- Response time: <5 seconds
- Overall pass rate: 80%

## Monitoring and Maintenance

### Health Checks

The system monitors:

- **Document Freshness**: Source file modification times
- **Embedding Quality**: Validation of stored embeddings
- **Search Performance**: Response times and accuracy
- **Error Rates**: Failed operations and retries

### Automated Maintenance

- **Daily Validation**: Automated quality checks
- **Weekly Optimization**: Index optimization and cleanup
- **Monthly Updates**: Incremental content updates
- **Backup Rotation**: Automated backup management

### Status Dashboard

Check system status:

```bash
npx tsx scripts/manage-knowledge-base.ts status
```

Output includes:
- Last update timestamp
- Total chunks and embeddings
- Source-by-source health status
- Health score and recommendations

## Troubleshooting

### Common Issues

#### 1. Ingestion Failures

**Symptoms**: Script fails during document processing or embedding generation

**Solutions**:
- Check OpenAI API key validity
- Verify source document accessibility
- Review rate limiting settings
- Check available disk space

#### 2. Low Search Quality

**Symptoms**: Poor search results, low similarity scores

**Solutions**:
- Run quality tests: `npx tsx scripts/test-search-quality.ts`
- Review chunking strategy
- Check for outdated embeddings
- Validate source document quality

#### 3. Performance Issues

**Symptoms**: Slow search responses, timeouts

**Solutions**:
- Enable caching
- Optimize chunk sizes
- Review embedding dimensions
- Check network connectivity

#### 4. Missing Results

**Symptoms**: Expected content not found in search

**Solutions**:
- Verify document processing completed
- Check chunk quality filters
- Review embedding generation logs
- Validate source document content

### Debug Mode

Enable verbose logging:

```bash
npx tsx scripts/manage-knowledge-base.ts ingest --verbose
```

### Log Files

Logs are stored in:
- `logs/kb-management-YYYY-MM-DD.log`: Management operations
- `data/search-tests/`: Quality test results
- `data/backups/`: System backups

## Production Deployment

### Cloudflare Setup

1. **Create Vectorize Index**
   ```bash
   wrangler vectorize create ask-the-captain-knowledge-base --dimensions=1536 --metric=cosine
   ```

2. **Create D1 Database**
   ```bash
   wrangler d1 create ask-the-captain-db
   ```

3. **Update wrangler.toml**
   ```toml
   [env.production]
   name = "ask-the-captain-production"
   
   [[env.production.d1_databases]]
   binding = "DB"
   database_name = "ask-the-captain-db-production"
   database_id = "your-database-id"
   
   [[env.production.vectorize]]
   binding = "VECTORIZE_INDEX"
   index_name = "ask-the-captain-knowledge-base-production"
   ```

4. **Set Secrets**
   ```bash
   wrangler secret put OPENAI_API_KEY --env production
   ```

### Production Ingestion

For production deployment, the ingestion process integrates with Cloudflare services:

```typescript
// Production ingestion uses Cloudflare bindings
const vectorizeClient = env.VECTORIZE_INDEX
const database = env.DB

// Ingest embeddings to Vectorize
await vectorizeClient.upsert(embeddings)

// Store metadata in D1
await database.prepare(
  "INSERT INTO knowledge_base_chunks (id, content, source, metadata) VALUES (?, ?, ?, ?)"
).bind(chunk.id, chunk.content, chunk.source, JSON.stringify(chunk.metadata)).run()
```

## API Integration

### Search Endpoint

The knowledge base integrates with the chat API:

```typescript
// /app/api/chat/route.ts
import { performSemanticSearch } from '@/lib/semantic-search'

export async function POST(request: Request) {
  const { message } = await request.json()
  
  // Search knowledge base
  const searchResults = await performSemanticSearch(
    message,
    embeddingService,
    vectorizeClient
  )
  
  // Use results in AI response
  const context = searchResults.results
    .map(r => r.content)
    .join('\n\n')
  
  // Generate response with context
  const response = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [
      { role: 'system', content: `${CAPITAO_CAVERNA_PROMPT}\n\nContext:\n${context}` },
      { role: 'user', content: message }
    ]
  })
  
  return Response.json({ response: response.choices[0].message.content })
}
```

## Best Practices

### Content Management

1. **Source Control**: Keep source documents in version control
2. **Regular Updates**: Update knowledge base when source content changes
3. **Quality Assurance**: Run quality tests before deploying updates
4. **Backup Strategy**: Maintain regular backups before major changes

### Performance Optimization

1. **Chunking Strategy**: Optimize chunk size for your content type
2. **Caching**: Implement embedding caching for frequently accessed content
3. **Batch Processing**: Use appropriate batch sizes for API calls
4. **Rate Limiting**: Respect API rate limits to avoid failures

### Security

1. **API Keys**: Store API keys securely using Cloudflare secrets
2. **Access Control**: Implement proper access controls for management tools
3. **Data Privacy**: Ensure compliance with data protection requirements
4. **Audit Logging**: Maintain logs of all management operations

## Advanced Configuration

### Custom Chunking

Modify chunking behavior in `lib/document-processor.ts`:

```typescript
const processor = new DocumentProcessor({
  chunkSize: 1000,        // Larger chunks for more context
  chunkOverlap: 150,      // More overlap for better continuity
  preserveStructure: true // Maintain document structure
})
```

### Search Optimization

Customize search parameters in `lib/semantic-search.ts`:

```typescript
const searchOptions = {
  topK: 15,                    // More results
  minScore: 0.7,              // Higher quality threshold
  diversityThreshold: 0.8,    // More diverse results
  contextWindowSize: 2000     // Larger context window
}
```

### Quality Thresholds

Adjust quality thresholds in test scripts:

```typescript
const qualityThresholds = {
  minSimilarity: 0.65,        // Higher similarity requirement
  minSourceRelevance: 0.6,    // Better source matching
  minKeywordCoverage: 0.7,    // More keyword coverage
  maxResponseTime: 3000       // Faster response requirement
}
```

## Support and Maintenance

### Regular Tasks

- **Weekly**: Run quality tests and review results
- **Monthly**: Update knowledge base with new content
- **Quarterly**: Optimize embeddings and search parameters
- **Annually**: Review and update documentation

### Monitoring Alerts

Set up monitoring for:
- Failed ingestion operations
- Search quality degradation
- Performance threshold breaches
- Storage capacity limits

### Getting Help

For issues or questions:
1. Check this documentation
2. Review log files for error details
3. Run diagnostic scripts
4. Check Cloudflare dashboard for service status

---

*Last updated: January 2025*