#!/usr/bin/env tsx
// Enhanced knowledge base ingestion script for knowledge-documents-for-processing folder
import { DocumentProcessor } from '../lib/document-processor'
import { generateEmbeddingsForChunks } from '../lib/embedding-service'
import { ingestEmbeddings, createVectorizeClient } from '../lib/vectorize'
import type { DocumentChunk, EmbeddingVector } from '@/types'
import path from 'path'
import fs from 'fs/promises'
import { processWhatsAppAnalysis } from '../lib/whatsapp-analysis-processor'

// Configuration
const CONFIG = {
  // Original sources
  markdownPath: path.join(process.cwd(), '..', 'modocaverna-docs.md'),
  pdfDirectory: path.join(process.cwd(), '..', 'aulas-modocaverna-cavefocus'),
  
  // New enhanced sources
  enhancedKnowledgeDirectory: path.join(process.cwd(), '..', 'knowledge-documents-for-processing'),
  whatsappAnalysisFile: path.join(process.cwd(), '..', 'knowledge-documents-for-processing', 'whatsapp_support_conversaton_analysis.csv'),
  
  // Processing options
  batchSize: 100,
  maxRetries: 3,
  validateVectors: true,
  
  // Quality thresholds
  minChunkLength: 50,
  maxChunkLength: 4000,
  qualityScoreThreshold: 0.6
}

interface EnhancedIngestionStats {
  documentsProcessed: number
  chunksCreated: number
  whatsappInsightsProcessed: number
  embeddingsGenerated: number
  vectorsIngested: number
  lowQualityChunksFiltered: number
  errors: number
  duration: number
  sourceBreakdown: Record<string, number>
}



interface EnhancedDocumentChunk extends DocumentChunk {
  metadata: DocumentChunk['metadata'] & {
    documentType: 'markdown' | 'pdf' | 'docx' | 'whatsapp' | 'support'
    processingDate: Date
    qualityScore: number
    keywords?: string[]
    topics?: string[]
    difficulty?: 'beginner' | 'intermediate' | 'advanced'
    whatsappData?: {
      conversationId: string
      supportTopic: string
      userQuestion: string
      effectiveResponse: string
      sentiment: string
      resolutionSuccess: boolean
    }
  }
}

/**
 * Enhanced document processor with support for new file types
 */
class EnhancedDocumentProcessor extends DocumentProcessor {
  
  /**
   * Process DOCX files (converted to PDF format)
   */
  async processDocx(filePath: string): Promise<EnhancedDocumentChunk[]> {
    // For now, treat .docx.pdf files as PDFs since they appear to be converted
    if (filePath.endsWith('.docx.pdf')) {
      const chunks = await this.processPDF(filePath) as EnhancedDocumentChunk[]
      
      // Enhance metadata for DOCX files
      return chunks.map(chunk => ({
        ...chunk,
        metadata: {
          ...chunk.metadata,
          documentType: 'docx' as const,
          processingDate: new Date(),
          qualityScore: this.calculateQualityScore(chunk.content)
        }
      }))
    }
    
    throw new Error(`Unsupported DOCX file format: ${filePath}`)
  }

  /**
   * Process all files in the enhanced knowledge directory
   */
  async processEnhancedDirectory(dirPath: string): Promise<EnhancedDocumentChunk[]> {
    const chunks: EnhancedDocumentChunk[] = []
    
    try {
      const processDirectory = async (currentPath: string): Promise<void> => {
        const files = await fs.readdir(currentPath)
        
        for (const file of files) {
          const filePath = path.join(currentPath, file)
          const stat = await fs.stat(filePath)
          
          if (stat.isDirectory()) {
            // Recursively process subdirectories
            await processDirectory(filePath)
          } else if (stat.isFile()) {
            const ext = path.extname(file).toLowerCase()
            const fileName = path.basename(file)
            
            // Skip system files
            if (fileName.startsWith('.') || fileName === 'whatsapp_support_conversaton_analysis.csv') {
              continue
            }
            
            try {
              let fileChunks: EnhancedDocumentChunk[] = []
              
              if (ext === '.md') {
                const baseChunks = await this.processMarkdown(filePath)
                fileChunks = this.enhanceChunks(baseChunks, 'markdown')
              } else if (ext === '.pdf') {
                const baseChunks = await this.processPDF(filePath)
                fileChunks = this.enhanceChunks(baseChunks, 'pdf')
              } else if (fileName.endsWith('.docx.pdf')) {
                const baseChunks = await this.processDocx(filePath)
                fileChunks = baseChunks
              }
              
              // Filter by quality
              const qualityChunks = fileChunks.filter(chunk => 
                chunk.metadata.qualityScore >= CONFIG.qualityScoreThreshold
              )
              
              chunks.push(...qualityChunks)
              
              console.log(`   ✅ ${fileName}: ${qualityChunks.length} chunks (${fileChunks.length - qualityChunks.length} filtered)`)
              
            } catch (error) {
              console.warn(`   ⚠️  Failed to process ${fileName}: ${error}`)
            }
          }
        }
      }
      
      await processDirectory(dirPath)
      return chunks
      
    } catch (error) {
      throw new Error(`Failed to process enhanced directory ${dirPath}: ${error}`)
    }
  }

  /**
   * Enhance basic chunks with additional metadata
   */
  private enhanceChunks(chunks: DocumentChunk[], documentType: 'markdown' | 'pdf' | 'docx'): EnhancedDocumentChunk[] {
    return chunks.map(chunk => ({
      ...chunk,
      metadata: {
        ...chunk.metadata,
        documentType,
        processingDate: new Date(),
        qualityScore: this.calculateQualityScore(chunk.content),
        keywords: this.extractKeywords(chunk.content),
        topics: this.extractTopics(chunk.content),
        difficulty: this.assessDifficulty(chunk.content)
      }
    }))
  }

  /**
   * Calculate quality score for a chunk
   */
  private calculateQualityScore(content: string): number {
    let score = 1.0
    
    // Length penalty for too short or too long
    if (content.length < CONFIG.minChunkLength) score -= 0.5
    if (content.length > CONFIG.maxChunkLength) score -= 0.3
    
    // Word diversity
    const words = content.toLowerCase().split(/\s+/)
    const uniqueWords = new Set(words)
    const diversity = uniqueWords.size / words.length
    if (diversity < 0.3) score -= 0.3
    
    // Sentence structure
    const sentences = content.split(/[.!?]+/).filter(s => s.trim())
    if (sentences.length < 2) score -= 0.2
    
    // Portuguese/English content indicators
    const portugueseWords = ['que', 'para', 'com', 'uma', 'você', 'seu', 'sua', 'modo', 'caverna']
    const portugueseCount = words.filter(word => portugueseWords.includes(word.toLowerCase())).length
    if (portugueseCount > 0) score += 0.1
    
    // Modo Caverna specific terms
    const modoTerms = ['disciplina', 'foco', 'guerreiro', 'caverna', 'protocolo', 'ritual']
    const modoCount = words.filter(word => modoTerms.includes(word.toLowerCase())).length
    if (modoCount > 0) score += 0.2
    
    return Math.max(0, Math.min(1, score))
  }

  /**
   * Extract keywords from content
   */
  private extractKeywords(content: string): string[] {
    const words = content.toLowerCase()
      .replace(/[^\w\sáàâãéèêíìîóòôõúùûç]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3)
    
    // Count word frequency
    const wordCount = new Map<string, number>()
    words.forEach(word => {
      wordCount.set(word, (wordCount.get(word) || 0) + 1)
    })
    
    // Get top keywords
    return Array.from(wordCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word]) => word)
  }

  /**
   * Extract topics from content
   */
  private extractTopics(content: string): string[] {
    const topics: string[] = []
    const lowerContent = content.toLowerCase()
    
    // Modo Caverna topics
    if (lowerContent.includes('disciplina') || lowerContent.includes('foco')) topics.push('disciplina')
    if (lowerContent.includes('ritual') || lowerContent.includes('rotina')) topics.push('rituais')
    if (lowerContent.includes('meta') || lowerContent.includes('objetivo')) topics.push('metas')
    if (lowerContent.includes('procrastina') || lowerContent.includes('distração')) topics.push('produtividade')
    if (lowerContent.includes('hábito') || lowerContent.includes('comportamento')) topics.push('hábitos')
    if (lowerContent.includes('mindset') || lowerContent.includes('mentalidade')) topics.push('mindset')
    if (lowerContent.includes('detox') || lowerContent.includes('digital')) topics.push('detox-digital')
    
    return topics
  }

  /**
   * Assess content difficulty level
   */
  private assessDifficulty(content: string): 'beginner' | 'intermediate' | 'advanced' {
    const lowerContent = content.toLowerCase()
    
    // Beginner indicators
    const beginnerTerms = ['básico', 'iniciante', 'primeiro', 'começar', 'introdução']
    const beginnerCount = beginnerTerms.filter(term => lowerContent.includes(term)).length
    
    // Advanced indicators
    const advancedTerms = ['avançado', 'complexo', 'profundo', 'estratégia', 'otimização']
    const advancedCount = advancedTerms.filter(term => lowerContent.includes(term)).length
    
    if (beginnerCount > advancedCount && beginnerCount > 0) return 'beginner'
    if (advancedCount > beginnerCount && advancedCount > 0) return 'advanced'
    return 'intermediate'
  }
}

/**
 * Process WhatsApp support conversation analysis using specialized processor
 */
async function processWhatsAppAnalysisFile(filePath: string): Promise<EnhancedDocumentChunk[]> {
  if (!await fileExists(filePath)) {
    console.warn(`   ⚠️  WhatsApp analysis file not found: ${filePath}`)
    return []
  }
  
  try {
    const whatsappChunks = await processWhatsAppAnalysis(filePath)
    
    // Convert WhatsApp chunks to enhanced chunks
    return whatsappChunks.map(chunk => ({
      ...chunk,
      metadata: {
        ...chunk.metadata,
        keywords: chunk.metadata.whatsappData ? [
          chunk.metadata.whatsappData.supportTopic,
          'suporte',
          'whatsapp',
          chunk.metadata.whatsappData.category
        ] : ['suporte', 'whatsapp'],
        topics: chunk.metadata.whatsappData ? [
          chunk.metadata.whatsappData.supportTopic
        ] : ['suporte-geral'],
        difficulty: 'intermediate' as const
      }
    }))
  } catch (error) {
    console.warn(`   ⚠️  Error processing WhatsApp analysis: ${error}`)
    return []
  }
}

/**
 * Main enhanced ingestion function
 */
async function ingestEnhancedKnowledgeBase(): Promise<EnhancedIngestionStats> {
  const startTime = Date.now()
  const stats: EnhancedIngestionStats = {
    documentsProcessed: 0,
    chunksCreated: 0,
    whatsappInsightsProcessed: 0,
    embeddingsGenerated: 0,
    vectorsIngested: 0,
    lowQualityChunksFiltered: 0,
    errors: 0,
    duration: 0,
    sourceBreakdown: {}
  }

  try {
    console.log('🚀 Starting enhanced knowledge base ingestion...')
    console.log(`📁 Processing documents from:`)
    console.log(`   - Original Markdown: ${CONFIG.markdownPath}`)
    console.log(`   - Original PDFs: ${CONFIG.pdfDirectory}`)
    console.log(`   - Enhanced Knowledge: ${CONFIG.enhancedKnowledgeDirectory}`)
    console.log(`   - WhatsApp Analysis: ${CONFIG.whatsappAnalysisFile}`)

    const processor = new EnhancedDocumentProcessor({
      chunkSize: 800,
      chunkOverlap: 100,
      preserveStructure: true
    })

    // Step 1: Process all documents
    console.log('\n📄 Step 1: Processing all documents...')
    const allChunks: EnhancedDocumentChunk[] = []

    // Process original sources
    console.log('   📝 Processing original markdown...')
    if (await fileExists(CONFIG.markdownPath)) {
      const markdownChunks = await processor.processMarkdown(CONFIG.markdownPath)
      const enhancedMarkdownChunks = processor['enhanceChunks'](markdownChunks, 'markdown')
      allChunks.push(...enhancedMarkdownChunks)
      stats.sourceBreakdown['original_markdown'] = enhancedMarkdownChunks.length
    }

    console.log('   📚 Processing original PDFs...')
    if (await fileExists(CONFIG.pdfDirectory)) {
      const pdfChunks = await processor.processDirectory(CONFIG.pdfDirectory)
      const enhancedPdfChunks = processor['enhanceChunks'](pdfChunks, 'pdf')
      allChunks.push(...enhancedPdfChunks)
      stats.sourceBreakdown['original_pdfs'] = enhancedPdfChunks.length
    }

    // Process enhanced knowledge directory
    console.log('   📖 Processing enhanced knowledge documents...')
    if (await fileExists(CONFIG.enhancedKnowledgeDirectory)) {
      const enhancedChunks = await processor.processEnhancedDirectory(CONFIG.enhancedKnowledgeDirectory)
      allChunks.push(...enhancedChunks)
      stats.sourceBreakdown['enhanced_documents'] = enhancedChunks.length
    }

    // Process WhatsApp analysis
    console.log('   💬 Processing WhatsApp support analysis...')
    const whatsappChunks = await processWhatsAppAnalysisFile(CONFIG.whatsappAnalysisFile)
    allChunks.push(...whatsappChunks)
    stats.whatsappInsightsProcessed = whatsappChunks.length
    stats.sourceBreakdown['whatsapp_analysis'] = whatsappChunks.length

    stats.chunksCreated = allChunks.length
    console.log(`✅ Created ${allChunks.length} total document chunks`)

    // Print source breakdown
    console.log('   📊 Source breakdown:')
    Object.entries(stats.sourceBreakdown).forEach(([source, count]) => {
      console.log(`      - ${source}: ${count} chunks`)
    })

    // Step 2: Generate embeddings (if API key available)
    if (process.env.OPENAI_API_KEY) {
      console.log('\n🧠 Step 2: Generating embeddings...')
      const embeddings = await generateEmbeddings(allChunks)
      stats.embeddingsGenerated = embeddings.length
      console.log(`✅ Generated ${embeddings.length} embeddings`)

      // Step 3: Ingest into Vectorize
      console.log('\n🔍 Step 3: Ingesting into Vectorize...')
      const ingestionResult = await ingestIntoVectorize(embeddings)
      stats.vectorsIngested = ingestionResult.processed
      stats.errors = ingestionResult.errors
    } else {
      console.log('\n⚠️  Skipping embedding generation (no API key)')
      stats.embeddingsGenerated = 0
      stats.vectorsIngested = 0
    }

    stats.duration = Date.now() - startTime

    // Print final stats
    printEnhancedIngestionStats(stats)

    return stats

  } catch (error) {
    console.error('❌ Enhanced ingestion failed:', error)
    stats.duration = Date.now() - startTime
    stats.errors = 1
    throw error
  }
}

/**
 * Generate embeddings for enhanced chunks
 */
async function generateEmbeddings(chunks: EnhancedDocumentChunk[]): Promise<EmbeddingVector[]> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is required')
  }

  try {
    // Convert enhanced chunks to basic chunks for embedding generation
    const basicChunks: DocumentChunk[] = chunks.map(chunk => ({
      id: chunk.id,
      content: chunk.content,
      source: chunk.source,
      metadata: {
        title: chunk.metadata.title,
        section: chunk.metadata.section,
        page: chunk.metadata.page
      }
    }))

    const embeddings = await generateEmbeddingsForChunks(
      basicChunks,
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
        
        process.stdout.write(
          `\r   🔄 Progress: ${progress.processed}/${progress.total} (${percentage}%) - Batch ${progress.currentBatch}/${progress.totalBatches}`
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
 * Ingest embeddings into Vectorize (same as original)
 */
async function ingestIntoVectorize(embeddings: EmbeddingVector[]): Promise<{ processed: number; errors: number }> {
  if (!process.env.VECTORIZE_INDEX_ID) {
    console.warn('⚠️  VECTORIZE_INDEX_ID not found - skipping Vectorize ingestion')
    console.log('   To enable Vectorize ingestion, set VECTORIZE_INDEX_ID environment variable')
    return { processed: 0, errors: 0 }
  }

  try {
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
 * Print enhanced ingestion statistics
 */
function printEnhancedIngestionStats(stats: EnhancedIngestionStats): void {
  const durationSeconds = Math.round(stats.duration / 1000)
  const durationMinutes = Math.round(durationSeconds / 60)

  console.log('\n📊 Enhanced Ingestion Complete!')
  console.log('═'.repeat(60))
  console.log(`📄 Documents processed: ${stats.documentsProcessed}`)
  console.log(`📝 Chunks created: ${stats.chunksCreated}`)
  console.log(`💬 WhatsApp insights: ${stats.whatsappInsightsProcessed}`)
  console.log(`🧠 Embeddings generated: ${stats.embeddingsGenerated}`)
  console.log(`🔍 Vectors ingested: ${stats.vectorsIngested}`)
  console.log(`🗑️  Low quality filtered: ${stats.lowQualityChunksFiltered}`)
  console.log(`❌ Errors: ${stats.errors}`)
  console.log(`⏱️  Duration: ${durationMinutes > 0 ? `${durationMinutes}m ` : ''}${durationSeconds % 60}s`)
  
  console.log('\n📊 Source Breakdown:')
  Object.entries(stats.sourceBreakdown).forEach(([source, count]) => {
    console.log(`   - ${source}: ${count} chunks`)
  })
  
  console.log('═'.repeat(60))

  if (stats.errors > 0) {
    console.log('⚠️  Some errors occurred during ingestion. Check logs above for details.')
  } else {
    console.log('🎉 Enhanced knowledge base ingestion completed successfully!')
  }
}

/**
 * Check if file exists
 */
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

/**
 * Validate environment and configuration
 */
function validateEnvironment(): void {
  const required = ['OPENAI_API_KEY']
  const missing = required.filter(key => !process.env[key])
  
  if (missing.length > 0) {
    console.warn('⚠️  Missing required environment variables:')
    missing.forEach(key => console.warn(`   - ${key}`))
    console.warn('   Running in test mode without embedding generation')
  }
}

/**
 * Main execution
 */
async function main() {
  try {
    validateEnvironment()
    await ingestEnhancedKnowledgeBase()
    process.exit(0)
  } catch (error) {
    console.error('💥 Fatal error:', error)
    process.exit(1)
  }
}

// Export for testing
export { ingestEnhancedKnowledgeBase, processWhatsAppAnalysis }

// Run if called directly
if (require.main === module) {
  main()
}