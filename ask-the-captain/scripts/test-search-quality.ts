#!/usr/bin/env tsx
// Search quality testing and optimization script
import { generateEmbeddingsForChunks } from '../lib/embedding-service'
import type { DocumentChunk, EmbeddingVector } from '@/types'
import fs from 'fs/promises'
import path from 'path'

// Configuration
const CONFIG = {
  dataDirectory: path.join(process.cwd(), 'data', 'knowledge-base'),
  testQueriesFile: path.join(process.cwd(), 'data', 'test-queries.json'),
  resultsDirectory: path.join(process.cwd(), 'data', 'search-tests'),
  similarityThreshold: 0.7,
  topK: 10
}

interface TestQuery {
  id: string
  query: string
  expectedSources?: string[]
  expectedKeywords?: string[]
  category: 'basic' | 'complex' | 'edge-case'
  description: string
}

interface SearchTestResult {
  queryId: string
  query: string
  results: Array<{
    content: string
    source: string
    similarity: number
    rank: number
  }>
  metrics: {
    averageSimilarity: number
    sourceRelevance: number
    keywordCoverage: number
    responseTime: number
  }
  passed: boolean
  issues: string[]
}

interface QualityReport {
  timestamp: Date
  totalQueries: number
  passedQueries: number
  averageScore: number
  categoryScores: Record<string, number>
  commonIssues: Record<string, number>
  recommendations: string[]
}

/**
 * Main search quality testing function
 */
async function testSearchQuality(): Promise<QualityReport> {
  console.log('🔍 Starting search quality testing...')
  
  // Ensure directories exist
  await fs.mkdir(CONFIG.resultsDirectory, { recursive: true })
  
  // Load test queries
  const testQueries = await loadTestQueries()
  console.log(`📝 Loaded ${testQueries.length} test queries`)
  
  // Load knowledge base
  const { chunks, embeddings } = await loadKnowledgeBase()
  console.log(`📚 Loaded ${chunks.length} chunks and ${embeddings.length} embeddings`)
  
  // Run tests
  const results: SearchTestResult[] = []
  
  for (let i = 0; i < testQueries.length; i++) {
    const query = testQueries[i]
    console.log(`\n🔍 Testing query ${i + 1}/${testQueries.length}: "${query.query}"`)
    
    try {
      const result = await testSingleQuery(query, chunks, embeddings)
      results.push(result)
      
      const status = result.passed ? '✅' : '❌'
      console.log(`   ${status} Score: ${Math.round(result.metrics.averageSimilarity * 100)}%`)
      
      if (!result.passed && result.issues.length > 0) {
        console.log(`   Issues: ${result.issues.join(', ')}`)
      }
      
    } catch (error) {
      console.error(`   ❌ Test failed: ${error}`)
      results.push({
        queryId: query.id,
        query: query.query,
        results: [],
        metrics: {
          averageSimilarity: 0,
          sourceRelevance: 0,
          keywordCoverage: 0,
          responseTime: 0
        },
        passed: false,
        issues: [`Test execution failed: ${error}`]
      })
    }
  }
  
  // Generate report
  const report = generateQualityReport(results, testQueries)
  
  // Save results
  await saveTestResults(results, report)
  
  // Print summary
  printQualitySummary(report)
  
  return report
}

/**
 * Test a single query against the knowledge base
 */
async function testSingleQuery(
  testQuery: TestQuery,
  chunks: DocumentChunk[],
  embeddings: EmbeddingVector[]
): Promise<SearchTestResult> {
  const startTime = Date.now()
  
  // Generate query embedding
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is required')
  }
  
  const queryChunk: DocumentChunk = {
    id: `test_query_${testQuery.id}`,
    content: testQuery.query,
    source: 'test_query',
    metadata: {}
  }
  
  const queryEmbeddings = await generateEmbeddingsForChunks([queryChunk], apiKey)
  if (queryEmbeddings.length === 0) {
    throw new Error('Failed to generate query embedding')
  }
  
  const queryEmbedding = queryEmbeddings[0].values
  
  // Calculate similarities
  const similarities = embeddings.map((embedding, index) => ({
    index,
    similarity: cosineSimilarity(queryEmbedding, embedding.values),
    chunk: chunks[index],
    embedding
  }))
  
  // Sort by similarity and take top K
  const topResults = similarities
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, CONFIG.topK)
  
  const responseTime = Date.now() - startTime
  
  // Format results
  const results = topResults.map((result, rank) => ({
    content: result.chunk.content,
    source: result.chunk.source,
    similarity: result.similarity,
    rank: rank + 1
  }))
  
  // Calculate metrics
  const metrics = calculateMetrics(testQuery, results, responseTime)
  
  // Determine if test passed
  const passed = evaluateTestResult(testQuery, results, metrics)
  
  // Identify issues
  const issues = identifyIssues(testQuery, results, metrics)
  
  return {
    queryId: testQuery.id,
    query: testQuery.query,
    results,
    metrics,
    passed,
    issues
  }
}

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same length')
  }
  
  let dotProduct = 0
  let normA = 0
  let normB = 0
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
}

/**
 * Calculate quality metrics for a test result
 */
function calculateMetrics(
  testQuery: TestQuery,
  results: Array<{ content: string; source: string; similarity: number; rank: number }>,
  responseTime: number
): SearchTestResult['metrics'] {
  // Average similarity
  const averageSimilarity = results.length > 0 
    ? results.reduce((sum, r) => sum + r.similarity, 0) / results.length
    : 0
  
  // Source relevance (if expected sources are specified)
  let sourceRelevance = 1.0
  if (testQuery.expectedSources && testQuery.expectedSources.length > 0) {
    const relevantResults = results.filter(r => 
      testQuery.expectedSources!.some(expectedSource => 
        r.source.includes(expectedSource) || expectedSource.includes(r.source)
      )
    )
    sourceRelevance = relevantResults.length / Math.min(results.length, testQuery.expectedSources.length)
  }
  
  // Keyword coverage (if expected keywords are specified)
  let keywordCoverage = 1.0
  if (testQuery.expectedKeywords && testQuery.expectedKeywords.length > 0) {
    const allContent = results.map(r => r.content.toLowerCase()).join(' ')
    const foundKeywords = testQuery.expectedKeywords.filter(keyword => 
      allContent.includes(keyword.toLowerCase())
    )
    keywordCoverage = foundKeywords.length / testQuery.expectedKeywords.length
  }
  
  return {
    averageSimilarity,
    sourceRelevance,
    keywordCoverage,
    responseTime
  }
}

/**
 * Evaluate if a test result passes quality thresholds
 */
function evaluateTestResult(
  testQuery: TestQuery,
  results: Array<{ content: string; source: string; similarity: number; rank: number }>,
  metrics: SearchTestResult['metrics']
): boolean {
  // Basic quality thresholds
  const minSimilarity = 0.6
  const minSourceRelevance = 0.5
  const minKeywordCoverage = 0.5
  const maxResponseTime = 5000 // 5 seconds
  
  return (
    metrics.averageSimilarity >= minSimilarity &&
    metrics.sourceRelevance >= minSourceRelevance &&
    metrics.keywordCoverage >= minKeywordCoverage &&
    metrics.responseTime <= maxResponseTime &&
    results.length > 0
  )
}

/**
 * Identify specific issues with a test result
 */
function identifyIssues(
  testQuery: TestQuery,
  results: Array<{ content: string; source: string; similarity: number; rank: number }>,
  metrics: SearchTestResult['metrics']
): string[] {
  const issues: string[] = []
  
  if (results.length === 0) {
    issues.push('No results returned')
  }
  
  if (metrics.averageSimilarity < 0.6) {
    issues.push('Low semantic similarity')
  }
  
  if (metrics.sourceRelevance < 0.5) {
    issues.push('Poor source relevance')
  }
  
  if (metrics.keywordCoverage < 0.5) {
    issues.push('Missing expected keywords')
  }
  
  if (metrics.responseTime > 5000) {
    issues.push('Slow response time')
  }
  
  // Check for diversity in results
  const uniqueSources = new Set(results.map(r => r.source))
  if (uniqueSources.size === 1 && results.length > 3) {
    issues.push('Lack of source diversity')
  }
  
  // Check for very short results
  const shortResults = results.filter(r => r.content.length < 100)
  if (shortResults.length > results.length / 2) {
    issues.push('Too many short results')
  }
  
  return issues
}

/**
 * Generate overall quality report
 */
function generateQualityReport(
  results: SearchTestResult[],
  testQueries: TestQuery[]
): QualityReport {
  const passedQueries = results.filter(r => r.passed).length
  const averageScore = results.reduce((sum, r) => sum + r.metrics.averageSimilarity, 0) / results.length
  
  // Category scores
  const categoryScores: Record<string, number> = {}
  const categories = ['basic', 'complex', 'edge-case']
  
  categories.forEach(category => {
    const categoryResults = results.filter(r => {
      const query = testQueries.find(q => q.id === r.queryId)
      return query?.category === category
    })
    
    if (categoryResults.length > 0) {
      categoryScores[category] = categoryResults.filter(r => r.passed).length / categoryResults.length
    }
  })
  
  // Common issues
  const commonIssues: Record<string, number> = {}
  results.forEach(result => {
    result.issues.forEach(issue => {
      commonIssues[issue] = (commonIssues[issue] || 0) + 1
    })
  })
  
  // Generate recommendations
  const recommendations = generateRecommendations(results, commonIssues)
  
  return {
    timestamp: new Date(),
    totalQueries: results.length,
    passedQueries,
    averageScore,
    categoryScores,
    commonIssues,
    recommendations
  }
}

/**
 * Generate recommendations based on test results
 */
function generateRecommendations(
  results: SearchTestResult[],
  commonIssues: Record<string, number>
): string[] {
  const recommendations: string[] = []
  const totalQueries = results.length
  
  // Check for common issues
  Object.entries(commonIssues).forEach(([issue, count]) => {
    const percentage = (count / totalQueries) * 100
    
    if (percentage > 20) {
      switch (issue) {
        case 'Low semantic similarity':
          recommendations.push('Consider retraining embeddings or adjusting chunk size')
          break
        case 'Poor source relevance':
          recommendations.push('Review source prioritization in ranking algorithm')
          break
        case 'Missing expected keywords':
          recommendations.push('Implement keyword boosting in search ranking')
          break
        case 'Slow response time':
          recommendations.push('Optimize embedding generation or implement caching')
          break
        case 'Lack of source diversity':
          recommendations.push('Implement diversity scoring in result ranking')
          break
        case 'Too many short results':
          recommendations.push('Filter out very short chunks or adjust chunking strategy')
          break
      }
    }
  })
  
  // Check overall performance
  const passRate = results.filter(r => r.passed).length / totalQueries
  if (passRate < 0.8) {
    recommendations.push('Overall search quality is below target - consider comprehensive review')
  }
  
  // Check category performance
  const basicQueries = results.filter(r => {
    // This would need to be matched with testQueries, simplified for now
    return r.queryId.includes('basic')
  })
  
  if (basicQueries.length > 0) {
    const basicPassRate = basicQueries.filter(r => r.passed).length / basicQueries.length
    if (basicPassRate < 0.9) {
      recommendations.push('Basic queries underperforming - check fundamental search setup')
    }
  }
  
  return recommendations
}

/**
 * Load test queries from file
 */
async function loadTestQueries(): Promise<TestQuery[]> {
  try {
    const data = await fs.readFile(CONFIG.testQueriesFile, 'utf-8')
    return JSON.parse(data)
  } catch (error) {
    // Return default test queries if file doesn't exist
    return getDefaultTestQueries()
  }
}

/**
 * Get default test queries
 */
function getDefaultTestQueries(): TestQuery[] {
  return [
    {
      id: 'basic-001',
      query: 'O que é o Modo Caverna?',
      expectedSources: ['modocaverna-docs'],
      expectedKeywords: ['modo caverna', 'metodologia', 'transformação'],
      category: 'basic',
      description: 'Basic question about the core concept'
    },
    {
      id: 'basic-002',
      query: 'Quais são os três pilares fundamentais?',
      expectedSources: ['modocaverna-docs'],
      expectedKeywords: ['propósito', 'foco', 'progresso'],
      category: 'basic',
      description: 'Question about the three pillars'
    },
    {
      id: 'basic-003',
      query: 'Como funciona o desafio de 40 dias?',
      expectedSources: ['Módulo-2'],
      expectedKeywords: ['40 dias', 'desafio', 'transformação'],
      category: 'basic',
      description: 'Question about the 40-day challenge'
    },
    {
      id: 'complex-001',
      query: 'Como combater a procrastinação usando a metodologia Caverna?',
      expectedKeywords: ['procrastinação', 'disciplina', 'foco'],
      category: 'complex',
      description: 'Complex question combining concepts'
    },
    {
      id: 'complex-002',
      query: 'Qual a diferença entre Cave Focus e outros métodos de produtividade?',
      expectedSources: ['CAVE-FOCUS'],
      expectedKeywords: ['cave focus', 'produtividade', 'diferença'],
      category: 'complex',
      description: 'Comparative question about Cave Focus'
    },
    {
      id: 'edge-001',
      query: 'Como aplicar o Modo Caverna em relacionamentos?',
      category: 'edge-case',
      description: 'Edge case - applying methodology to relationships'
    },
    {
      id: 'edge-002',
      query: 'O que fazer quando não consigo manter a disciplina?',
      expectedKeywords: ['disciplina', 'consistência'],
      category: 'edge-case',
      description: 'Edge case - handling failure/setbacks'
    }
  ]
}

/**
 * Load knowledge base from local files
 */
async function loadKnowledgeBase(): Promise<{
  chunks: DocumentChunk[]
  embeddings: EmbeddingVector[]
}> {
  try {
    const chunksData = await fs.readFile(path.join(CONFIG.dataDirectory, 'chunks.json'), 'utf-8')
    const embeddingsData = await fs.readFile(path.join(CONFIG.dataDirectory, 'embeddings.json'), 'utf-8')
    
    const chunks: DocumentChunk[] = JSON.parse(chunksData)
    const embeddings: EmbeddingVector[] = JSON.parse(embeddingsData)
    
    return { chunks, embeddings }
  } catch (error) {
    throw new Error(`Failed to load knowledge base: ${error}`)
  }
}

/**
 * Save test results and report
 */
async function saveTestResults(results: SearchTestResult[], report: QualityReport): Promise<void> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  
  // Save detailed results
  await fs.writeFile(
    path.join(CONFIG.resultsDirectory, `test-results-${timestamp}.json`),
    JSON.stringify(results, null, 2)
  )
  
  // Save quality report
  await fs.writeFile(
    path.join(CONFIG.resultsDirectory, `quality-report-${timestamp}.json`),
    JSON.stringify(report, null, 2)
  )
  
  // Save latest report (for easy access)
  await fs.writeFile(
    path.join(CONFIG.resultsDirectory, 'latest-report.json'),
    JSON.stringify(report, null, 2)
  )
}

/**
 * Print quality summary
 */
function printQualitySummary(report: QualityReport): void {
  console.log('\n📊 Search Quality Report')
  console.log('═'.repeat(50))
  
  const passRate = (report.passedQueries / report.totalQueries) * 100
  console.log(`📝 Total Queries: ${report.totalQueries}`)
  console.log(`✅ Passed: ${report.passedQueries} (${Math.round(passRate)}%)`)
  console.log(`📊 Average Score: ${Math.round(report.averageScore * 100)}%`)
  
  console.log('\n📈 Category Performance:')
  Object.entries(report.categoryScores).forEach(([category, score]) => {
    const percentage = Math.round(score * 100)
    const status = percentage >= 80 ? '✅' : percentage >= 60 ? '⚠️' : '❌'
    console.log(`   ${status} ${category}: ${percentage}%`)
  })
  
  if (Object.keys(report.commonIssues).length > 0) {
    console.log('\n⚠️  Common Issues:')
    Object.entries(report.commonIssues)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .forEach(([issue, count]) => {
        console.log(`   - ${issue}: ${count} queries`)
      })
  }
  
  if (report.recommendations.length > 0) {
    console.log('\n💡 Recommendations:')
    report.recommendations.forEach(rec => {
      console.log(`   - ${rec}`)
    })
  }
  
  console.log('═'.repeat(50))
  
  if (passRate >= 80) {
    console.log('🎉 Search quality is good!')
  } else if (passRate >= 60) {
    console.log('⚠️  Search quality needs improvement')
  } else {
    console.log('❌ Search quality requires immediate attention')
  }
}

/**
 * Main execution
 */
async function main() {
  try {
    await testSearchQuality()
    process.exit(0)
  } catch (error) {
    console.error('💥 Search quality testing failed:', error)
    process.exit(1)
  }
}

// Export for testing
export { testSearchQuality, testSingleQuery, cosineSimilarity }

// Run if called directly
if (require.main === module) {
  main()
}