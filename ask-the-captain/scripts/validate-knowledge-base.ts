#!/usr/bin/env tsx
// Knowledge base validation script
import { processAllDocuments } from '../lib/document-processor'
import { generateEmbeddingsForChunks } from '../lib/embedding-service'
import type { DocumentChunk, EmbeddingVector } from '@/types'
import path from 'path'

// Configuration
const CONFIG = {
  markdownPath: path.join(process.cwd(), '..', 'modocaverna-docs.md'),
  pdfDirectory: path.join(process.cwd(), '..', 'aulas-modocaverna-cavefocus'),
  testQueries: [
    'O que é o Modo Caverna?',
    'Como funciona o desafio de 40 dias?',
    'Quais são os três pilares fundamentais?',
    'Como combater a procrastinação?',
    'O que é Cave Focus?'
  ]
}

interface ValidationResult {
  documentsProcessed: boolean
  embeddingsGenerated: boolean
  searchFunctional: boolean
  testQueries: Array<{
    query: string
    success: boolean
    embedding?: number[]
    error?: string
  }>
  summary: {
    totalChunks: number
    totalEmbeddings: number
    averageChunkLength: number
    sourceDistribution: Record<string, number>
  }
}

/**
 * Main validation function
 */
async function validateKnowledgeBase(): Promise<ValidationResult> {
  console.log('🔍 Starting knowledge base validation...')
  
  const result: ValidationResult = {
    documentsProcessed: false,
    embeddingsGenerated: false,
    searchFunctional: false,
    testQueries: [],
    summary: {
      totalChunks: 0,
      totalEmbeddings: 0,
      averageChunkLength: 0,
      sourceDistribution: {}
    }
  }

  try {
    // Step 1: Validate document processing
    console.log('\n📄 Step 1: Validating document processing...')
    const chunks = await validateDocumentProcessing()
    result.documentsProcessed = true
    result.summary.totalChunks = chunks.length
    
    // Calculate summary statistics
    result.summary.averageChunkLength = chunks.reduce((sum, chunk) => sum + chunk.content.length, 0) / chunks.length
    result.summary.sourceDistribution = chunks.reduce((acc, chunk) => {
      acc[chunk.source] = (acc[chunk.source] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    
    console.log(`✅ Document processing validated: ${chunks.length} chunks`)

    // Step 2: Validate embedding generation
    console.log('\n🧠 Step 2: Validating embedding generation...')
    const embeddings = await validateEmbeddingGeneration(chunks.slice(0, 5)) // Test with first 5 chunks
    result.embeddingsGenerated = true
    result.summary.totalEmbeddings = embeddings.length
    
    console.log(`✅ Embedding generation validated: ${embeddings.length} embeddings`)

    // Step 3: Test search functionality
    console.log('\n🔍 Step 3: Testing search functionality...')
    const searchResults = await validateSearchFunctionality()
    result.searchFunctional = searchResults.every(r => r.success)
    result.testQueries = searchResults
    
    console.log(`✅ Search functionality tested: ${searchResults.filter(r => r.success).length}/${searchResults.length} queries successful`)

    // Print validation summary
    printValidationSummary(result)

    return result

  } catch (error) {
    console.error('❌ Validation failed:', error)
    throw error
  }
}

/**
 * Validate document processing
 */
async function validateDocumentProcessing(): Promise<DocumentChunk[]> {
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

    // Validate chunk quality
    const validChunks = chunks.filter(chunk => {
      return (
        chunk.content.length > 50 &&
        chunk.content.length < 5000 &&
        chunk.source &&
        chunk.id &&
        chunk.metadata
      )
    })

    if (validChunks.length !== chunks.length) {
      console.warn(`⚠️  ${chunks.length - validChunks.length} chunks failed quality validation`)
    }

    return validChunks

  } catch (error) {
    throw new Error(`Document processing validation failed: ${error}`)
  }
}

/**
 * Validate embedding generation
 */
async function validateEmbeddingGeneration(chunks: DocumentChunk[]): Promise<EmbeddingVector[]> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is required')
  }

  try {
    const embeddings = await generateEmbeddingsForChunks(
      chunks,
      apiKey,
      {
        batchSize: 5,
        maxRetries: 2
      }
    )

    // Validate embedding quality
    const validEmbeddings = embeddings.filter(embedding => {
      return (
        embedding.values.length === 1536 &&
        embedding.values.every(val => typeof val === 'number' && !isNaN(val)) &&
        embedding.metadata.content.length > 0
      )
    })

    if (validEmbeddings.length !== embeddings.length) {
      console.warn(`⚠️  ${embeddings.length - validEmbeddings.length} embeddings failed quality validation`)
    }

    return validEmbeddings

  } catch (error) {
    throw new Error(`Embedding generation validation failed: ${error}`)
  }
}

/**
 * Validate search functionality by testing query embedding generation
 */
async function validateSearchFunctionality(): Promise<Array<{
  query: string
  success: boolean
  embedding?: number[]
  error?: string
}>> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is required')
  }

  const results = []

  for (const query of CONFIG.testQueries) {
    try {
      console.log(`   Testing query: "${query}"`)
      
      // Create a mock chunk for the query
      const queryChunk: DocumentChunk = {
        id: `query_${Date.now()}`,
        content: query,
        source: 'user_query',
        metadata: {}
      }

      // Generate embedding for the query
      const embeddings = await generateEmbeddingsForChunks([queryChunk], apiKey)
      
      if (embeddings.length > 0 && embeddings[0].values.length === 1536) {
        results.push({
          query,
          success: true,
          embedding: embeddings[0].values
        })
        console.log(`   ✅ Query embedding generated successfully`)
      } else {
        results.push({
          query,
          success: false,
          error: 'Invalid embedding generated'
        })
        console.log(`   ❌ Query embedding generation failed`)
      }

    } catch (error) {
      results.push({
        query,
        success: false,
        error: String(error)
      })
      console.log(`   ❌ Query embedding generation failed: ${error}`)
    }
  }

  return results
}

/**
 * Print validation summary
 */
function printValidationSummary(result: ValidationResult): void {
  console.log('\n📊 Knowledge Base Validation Summary')
  console.log('═'.repeat(60))
  
  console.log(`📄 Document Processing: ${result.documentsProcessed ? '✅ PASSED' : '❌ FAILED'}`)
  console.log(`🧠 Embedding Generation: ${result.embeddingsGenerated ? '✅ PASSED' : '❌ FAILED'}`)
  console.log(`🔍 Search Functionality: ${result.searchFunctional ? '✅ PASSED' : '❌ FAILED'}`)
  
  console.log('\n📈 Statistics:')
  console.log(`   Total Chunks: ${result.summary.totalChunks}`)
  console.log(`   Total Embeddings: ${result.summary.totalEmbeddings}`)
  console.log(`   Average Chunk Length: ${Math.round(result.summary.averageChunkLength)} characters`)
  
  console.log('\n📚 Source Distribution:')
  Object.entries(result.summary.sourceDistribution).forEach(([source, count]) => {
    console.log(`   ${source}: ${count} chunks`)
  })
  
  console.log('\n🔍 Test Query Results:')
  result.testQueries.forEach(({ query, success, error }) => {
    const status = success ? '✅' : '❌'
    console.log(`   ${status} "${query}"${error ? ` - ${error}` : ''}`)
  })
  
  const successRate = result.testQueries.filter(q => q.success).length / result.testQueries.length * 100
  console.log(`\n🎯 Overall Success Rate: ${Math.round(successRate)}%`)
  
  console.log('═'.repeat(60))
  
  if (result.documentsProcessed && result.embeddingsGenerated && result.searchFunctional) {
    console.log('🎉 Knowledge base validation completed successfully!')
    console.log('💡 Ready for Vectorize ingestion when VECTORIZE_INDEX_ID is configured')
  } else {
    console.log('⚠️  Some validation checks failed. Review the issues above.')
  }
}

/**
 * Main execution
 */
async function main() {
  try {
    await validateKnowledgeBase()
    process.exit(0)
  } catch (error) {
    console.error('💥 Validation failed:', error)
    process.exit(1)
  }
}

// Export for testing
export { validateKnowledgeBase, validateDocumentProcessing, validateEmbeddingGeneration }

// Run if called directly
if (require.main === module) {
  main()
}