#!/usr/bin/env tsx
// Test script for enhanced semantic search functionality
import { EnhancedSemanticSearchService } from '../lib/enhanced-semantic-search'
import { EmbeddingService } from '../lib/embedding-service'
import { VectorizeClient } from '../lib/vectorize'

// Mock implementations for testing
class MockEmbeddingService extends EmbeddingService {
  constructor() {
    super('mock-api-key')
  }

  async generateSingleEmbedding(chunk: any): Promise<any> {
    // Return mock embedding vector
    return {
      id: chunk.id,
      values: Array(1536).fill(0).map(() => Math.random()),
      metadata: {
        content: chunk.content,
        source: chunk.source,
        title: chunk.metadata?.title,
        section: chunk.metadata?.section,
        chunk_index: 0,
        token_count: Math.ceil(chunk.content.length / 4)
      }
    }
  }
}

class MockVectorizeClient extends VectorizeClient {
  constructor() {
    super(null as any)
  }

  async search(embedding: number[], options: any): Promise<any[]> {
    // Return mock search results representing different source types
    return [
      {
        content: 'O Modo Caverna é uma metodologia de transformação pessoal baseada em disciplina, foco e ação consistente. O guerreiro que entra na caverna sai transformado.',
        score: 0.92,
        metadata: {
          source: 'modocaverna-docs.md',
          section: 'metodologia-core',
          title: 'Fundamentos do Modo Caverna'
        }
      },
      {
        content: 'Para desenvolver disciplina, você precisa criar rituais diários que fortaleçam sua capacidade de manter o foco mesmo quando não tem vontade.',
        score: 0.88,
        metadata: {
          source: 'aulas-modocaverna-cavefocus',
          section: 'modulo-1',
          title: 'Desenvolvendo Disciplina'
        }
      },
      {
        content: '**Categoria:** Problemas de Login e Acesso\n**Pergunta do Cliente:** Como faço para acessar o material do Modo Caverna?\n**Resposta Efetiva:** Para acessar o conteúdo, clique no link: https://desafio.modocaverna.com/material',
        score: 0.75,
        metadata: {
          source: 'whatsapp_support_analysis',
          section: 'conversation_KB_0008',
          title: 'Suporte: acesso-login',
          whatsappData: {
            conversationId: 'KB_0008',
            supportTopic: 'acesso-login',
            userQuestion: 'Como faço para acessar o material do Modo Caverna?',
            effectiveResponse: 'Para acessar o conteúdo, clique no link: https://desafio.modocaverna.com/material',
            sentiment: 'neutral',
            resolutionSuccess: true,
            category: 'Problemas de Login e Acesso',
            responseTime: 2
          }
        }
      },
      {
        content: 'O detox digital é fundamental para recuperar o foco. Elimine distrações desnecessárias e crie um ambiente propício para a concentração.',
        score: 0.82,
        metadata: {
          source: 'EBOOK - DETOX DIGITAL.pdf',
          section: 'chunk_0',
          title: 'Detox Digital'
        }
      },
      {
        content: 'Checklist para iniciar o Modo Caverna:\n- Definir objetivos claros\n- Eliminar distrações\n- Criar rituais matinais\n- Estabelecer métricas de progresso',
        score: 0.79,
        metadata: {
          source: 'Checklist Pré Caverna.pdf',
          section: 'chunk_0',
          title: 'Preparação para o Modo Caverna'
        }
      }
    ]
  }
}

/**
 * Test enhanced semantic search functionality
 */
async function testEnhancedSearch() {
  console.log('🧪 Testing Enhanced Semantic Search')
  console.log('=' .repeat(50))

  try {
    // Initialize mock services
    const embeddingService = new MockEmbeddingService()
    const vectorizeClient = new MockVectorizeClient()
    
    // Create enhanced search service
    const searchService = new EnhancedSemanticSearchService(
      embeddingService,
      vectorizeClient,
      {
        topK: 15,
        minScore: 0.65,
        maxResults: 6,
        hybridSearch: true,
        sourceWeighting: true,
        includeWhatsAppInsights: true
      }
    )

    // Test queries
    const testQueries = [
      'Como desenvolver disciplina?',
      'Preciso de ajuda para acessar o material',
      'Como fazer detox digital?',
      'Quais são os passos para começar o Modo Caverna?',
      'Estou com dificuldade para manter o foco'
    ]

    for (const query of testQueries) {
      console.log(`\n🔍 Query: "${query}"`)
      console.log('-'.repeat(40))
      
      const startTime = Date.now()
      const searchContext = await searchService.search(query)
      const searchTime = Date.now() - startTime
      
      console.log(`⏱️  Search time: ${searchTime}ms`)
      console.log(`📊 Results found: ${searchContext.results.length}`)
      console.log(`🎯 Average score: ${searchContext.qualityMetrics.averageScore.toFixed(3)}`)
      console.log(`🌈 Diversity score: ${searchContext.qualityMetrics.diversityScore.toFixed(3)}`)
      console.log(`🔄 Hybrid search used: ${searchContext.hybridSearchUsed}`)
      
      console.log('\n📋 Source breakdown:')
      Object.entries(searchContext.sourceBreakdown).forEach(([source, count]) => {
        console.log(`   - ${source}: ${count} results`)
      })
      
      console.log('\n🎯 Top results:')
      searchContext.results.slice(0, 3).forEach((result, index) => {
        console.log(`   ${index + 1}. [${result.sourceType}] Score: ${result.finalScore.toFixed(3)}`)
        console.log(`      Source: ${result.metadata.source}`)
        console.log(`      Content: ${result.content.substring(0, 100)}...`)
        if (result.keywordMatches.length > 0) {
          console.log(`      Keywords: ${result.keywordMatches.join(', ')}`)
        }
      })
    }

    console.log('\n✅ Enhanced search test completed successfully!')
    
  } catch (error) {
    console.error('❌ Enhanced search test failed:', error)
    throw error
  }
}

/**
 * Test source weighting functionality
 */
async function testSourceWeighting() {
  console.log('\n🏋️ Testing Source Weighting')
  console.log('=' .repeat(50))

  const embeddingService = new MockEmbeddingService()
  const vectorizeClient = new MockVectorizeClient()
  
  // Test with source weighting enabled
  const searchWithWeighting = new EnhancedSemanticSearchService(
    embeddingService,
    vectorizeClient,
    { sourceWeighting: true }
  )
  
  // Test without source weighting
  const searchWithoutWeighting = new EnhancedSemanticSearchService(
    embeddingService,
    vectorizeClient,
    { sourceWeighting: false }
  )

  const testQuery = 'Como desenvolver disciplina?'
  
  console.log(`\n🔍 Query: "${testQuery}"`)
  
  const withWeightingResults = await searchWithWeighting.search(testQuery)
  const withoutWeightingResults = await searchWithoutWeighting.search(testQuery)
  
  console.log('\n📊 Results comparison:')
  console.log('With source weighting:')
  withWeightingResults.results.slice(0, 3).forEach((result, index) => {
    console.log(`   ${index + 1}. Score: ${result.finalScore.toFixed(3)} - ${result.metadata.source}`)
  })
  
  console.log('\nWithout source weighting:')
  withoutWeightingResults.results.slice(0, 3).forEach((result, index) => {
    console.log(`   ${index + 1}. Score: ${result.finalScore.toFixed(3)} - ${result.metadata.source}`)
  })
}

/**
 * Test hybrid search functionality
 */
async function testHybridSearch() {
  console.log('\n🔀 Testing Hybrid Search')
  console.log('=' .repeat(50))

  const embeddingService = new MockEmbeddingService()
  const vectorizeClient = new MockVectorizeClient()
  
  // Test with hybrid search enabled
  const hybridSearch = new EnhancedSemanticSearchService(
    embeddingService,
    vectorizeClient,
    { hybridSearch: true, keywordWeight: 0.3 }
  )
  
  // Test with semantic search only
  const semanticOnlySearch = new EnhancedSemanticSearchService(
    embeddingService,
    vectorizeClient,
    { hybridSearch: false }
  )

  const testQuery = 'acesso material caverna'
  
  console.log(`\n🔍 Query: "${testQuery}"`)
  
  const hybridResults = await hybridSearch.search(testQuery)
  const semanticResults = await semanticOnlySearch.search(testQuery)
  
  console.log('\n📊 Results comparison:')
  console.log('Hybrid search (semantic + keyword):')
  hybridResults.results.slice(0, 3).forEach((result, index) => {
    console.log(`   ${index + 1}. Score: ${result.finalScore.toFixed(3)} - Keywords: [${result.keywordMatches.join(', ')}]`)
    console.log(`      ${result.content.substring(0, 80)}...`)
  })
  
  console.log('\nSemantic search only:')
  semanticResults.results.slice(0, 3).forEach((result, index) => {
    console.log(`   ${index + 1}. Score: ${result.finalScore.toFixed(3)}`)
    console.log(`      ${result.content.substring(0, 80)}...`)
  })
}

/**
 * Main test execution
 */
async function main() {
  try {
    await testEnhancedSearch()
    await testSourceWeighting()
    await testHybridSearch()
    
    console.log('\n🎉 All enhanced search tests passed!')
    process.exit(0)
  } catch (error) {
    console.error('💥 Test suite failed:', error)
    process.exit(1)
  }
}

// Run tests if called directly
if (require.main === module) {
  main()
}

export { testEnhancedSearch, testSourceWeighting, testHybridSearch }