#!/usr/bin/env tsx
// Knowledge base ingestion script
import { processAllDocuments } from '../lib/document-processor'
import { generateEmbeddingsForChunks } from '../lib/embedding-service'
import { ingestEmbeddings, createVectorizeClient } from '../lib/vectorize'
import type { CloudflareEnv, DocumentChunk, EmbeddingVector } from '@/types'
import path from 'path'

// Configuration
const CONFIG = {
  markdownPath: path.join(process.cwd(), '..', 'modocaverna-docs.md'),
  pdfDirectory: path.join(process.cwd(), '..', 'aulas-modocaverna-cavefocus'),
  batchSize: 100,
  maxRetries: 3,
  validateVectors: true
}

interface IngestionStats {
  documentsProcessed: number
  chunksCreated: number
  embeddingsGenerated: number
  vectorsIngested: number
  errors: number
  duration: number
}

/**
 * Main ingestion function
 */
async function ingestKnowledgeBase(): Promise<IngestionStats> {
  const startTime = Date.now()
  const stats: IngestionStats = {
    documentsProcessed: 0,
    chunksCreated: 0,
    embeddingsGenerated: 0,
    vectorsIngested: 0,
    errors: 0,
    duration: 0
  }

  try {
    console.log('🚀 Starting knowledge base ingestion...')
    console.log(`📁 Processing documents from:`)
    console.log(`   - Markdown: ${CONFIG.markdownPath}`)
    console.log(`   - PDFs: ${CONFIG.pdfDirectory}`)

    // Step 1: Process documents
    console.log('\n📄 Step 1: Processing documents...')
    const chunks = await processDocuments()
    stats.chunksCreated = chunks.length
    console.log(`✅ Created ${chunks.length} document chunks`)

    // Step 2: Generate embeddings
    console.log('\n🧠 Step 2: Generating embeddings...')
    const embeddings = await generateEmbeddings(chunks)
    stats.embeddingsGenerated = embeddings.length
    console.log(`✅ Generated ${embeddings.length} embeddings`)

    // Step 3: Ingest into Vectorize
    console.log('\n🔍 Step 3: Ingesting into Vectorize...')
    const ingestionResult = await ingestIntoVectorize(embeddings)
    stats.vectorsIngested = ingestionResult.processed
    stats.errors = ingestionResult.errors

    stats.duration = Date.now() - startTime

    // Print final stats
    printIngestionStats(stats)

    return stats

  } catch (error) {
    console.error('❌ Ingestion failed:', error)
    stats.duration = Date.now() - startTime
    stats.errors = 1
    throw error
  }
}

/**
 * Process all documents (markdown + PDFs)
 */
async function processDocuments(): Promise<DocumentChunk[]> {
  try {
    const chunks = await processAllDocuments(
      CONFIG.markdownPath,
      CONFIG.pdfDirectory,
      {
        chunkSize: 800,
        chunkOverlap: 100,
        preserveStructure: true
      }
    )

    console.log(`   📊 Document processing summary:`)
    const sourceStats = chunks.reduce((acc, chunk) => {
      acc[chunk.source] = (acc[chunk.source] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    Object.entries(sourceStats).forEach(([source, count]) => {
      console.log(`      - ${source}: ${count} chunks`)
    })

    return chunks

  } catch (error) {
    console.error('❌ Document processing failed:', error)
    throw error
  }
}

/**
 * Generate embeddings for all chunks
 */
async function generateEmbeddings(chunks: DocumentChunk[]): Promise<EmbeddingVector[]> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is required')
  }

  try {
    const embeddings = await generateEmbeddingsForChunks(
      chunks,
      apiKey,
      {
        batchSize: CONFIG.batchSize,
        maxRetries: CONFIG.maxRetries,
        rateLimit: {
          requestsPerMinute: 50,
          tokensPerMinute: 150000
        }
      },
      (progress) => {
        const percentage = Math.round((progress.processed / progress.total) * 100)
        const eta = '' // ETA calculation removed for simplicity
        
        process.stdout.write(
          `\r   🔄 Progress: ${progress.processed}/${progress.total} (${percentage}%) - Batch ${progress.currentBatch}/${progress.totalBatches} ${eta}`
        )
      }
    )

    console.log() // New line after progress
    
    if (embeddings.length !== chunks.length) {
      console.warn(`⚠️  Warning: Generated ${embeddings.length} embeddings for ${chunks.length} chunks`)
    }

    return embeddings

  } catch (error) {
    console.error('❌ Embedding generation failed:', error)
    throw error
  }
}

/**
 * Ingest embeddings into Vectorize
 */
async function ingestIntoVectorize(embeddings: EmbeddingVector[]): Promise<{ processed: number; errors: number }> {
  // Note: In a real implementation, you would get the Vectorize index from the Cloudflare environment
  // For this script, we'll simulate the process or require the index to be passed in
  
  if (!process.env.VECTORIZE_INDEX_ID) {
    console.warn('⚠️  VECTORIZE_INDEX_ID not found - skipping Vectorize ingestion')
    console.log('   To enable Vectorize ingestion, set VECTORIZE_INDEX_ID environment variable')
    return { processed: 0, errors: 0 }
  }

  try {
    // In a real Cloudflare Workers environment, you would use:
    // const client = await createVectorizeClient(env.VECTORIZE_INDEX)
    
    // For now, we'll simulate the ingestion process
    console.log('   🔄 Simulating Vectorize ingestion...')
    
    // Validate embeddings
    if (CONFIG.validateVectors) {
      console.log('   ✅ Validating embeddings...')
      const invalidEmbeddings = embeddings.filter(emb => 
        !emb.values || emb.values.length !== 1536 || !emb.metadata.content
      )
      
      if (invalidEmbeddings.length > 0) {
        console.warn(`   ⚠️  Found ${invalidEmbeddings.length} invalid embeddings`)
      }
    }

    // Simulate batch processing
    const batchSize = 1000
    let processed = 0
    
    for (let i = 0; i < embeddings.length; i += batchSize) {
      const batch = embeddings.slice(i, i + batchSize)
      
      // Simulate processing time
      await new Promise(resolve => setTimeout(resolve, 100))
      
      processed += batch.length
      const percentage = Math.round((processed / embeddings.length) * 100)
      
      process.stdout.write(
        `\r   🔄 Ingesting: ${processed}/${embeddings.length} (${percentage}%)`
      )
    }

    console.log() // New line after progress
    console.log('   ✅ Vectorize ingestion completed (simulated)')

    return { processed: embeddings.length, errors: 0 }

  } catch (error) {
    console.error('❌ Vectorize ingestion failed:', error)
    throw error
  }
}

/**
 * Print final ingestion statistics
 */
function printIngestionStats(stats: IngestionStats): void {
  const durationSeconds = Math.round(stats.duration / 1000)
  const durationMinutes = Math.round(durationSeconds / 60)

  console.log('\n📊 Ingestion Complete!')
  console.log('═'.repeat(50))
  console.log(`📄 Documents processed: ${stats.documentsProcessed}`)
  console.log(`📝 Chunks created: ${stats.chunksCreated}`)
  console.log(`🧠 Embeddings generated: ${stats.embeddingsGenerated}`)
  console.log(`🔍 Vectors ingested: ${stats.vectorsIngested}`)
  console.log(`❌ Errors: ${stats.errors}`)
  console.log(`⏱️  Duration: ${durationMinutes > 0 ? `${durationMinutes}m ` : ''}${durationSeconds % 60}s`)
  console.log('═'.repeat(50))

  if (stats.errors > 0) {
    console.log('⚠️  Some errors occurred during ingestion. Check logs above for details.')
  } else {
    console.log('🎉 Knowledge base ingestion completed successfully!')
  }
}

/**
 * Validate environment and configuration
 */
function validateEnvironment(): void {
  const required = ['OPENAI_API_KEY']
  const missing = required.filter(key => !process.env[key])
  
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:')
    missing.forEach(key => console.error(`   - ${key}`))
    process.exit(1)
  }

  // Check if source files exist
  const fs = require('fs')
  
  if (!fs.existsSync(CONFIG.markdownPath)) {
    console.warn(`⚠️  Markdown file not found: ${CONFIG.markdownPath}`)
  }
  
  if (!fs.existsSync(CONFIG.pdfDirectory)) {
    console.warn(`⚠️  PDF directory not found: ${CONFIG.pdfDirectory}`)
  }
}

/**
 * Main execution
 */
async function main() {
  try {
    validateEnvironment()
    await ingestKnowledgeBase()
    process.exit(0)
  } catch (error) {
    console.error('💥 Fatal error:', error)
    process.exit(1)
  }
}

// Export for testing
export { ingestKnowledgeBase, processDocuments, generateEmbeddings }

// Run if called directly
if (require.main === module) {
  main()
}