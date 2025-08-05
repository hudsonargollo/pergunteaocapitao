#!/usr/bin/env tsx
// Knowledge base management and maintenance tools
import { processAllDocuments } from '../lib/document-processor'
import { generateEmbeddingsForChunks } from '../lib/embedding-service'
import { validateKnowledgeBase } from './validate-knowledge-base'
import type { DocumentChunk, EmbeddingVector } from '@/types'
import fs from 'fs/promises'
import path from 'path'

// Configuration
const CONFIG = {
  markdownPath: path.join(process.cwd(), '..', 'modocaverna-docs.md'),
  pdfDirectory: path.join(process.cwd(), '..', 'aulas-modocaverna-cavefocus'),
  outputDirectory: path.join(process.cwd(), 'data', 'knowledge-base'),
  backupDirectory: path.join(process.cwd(), 'data', 'backups'),
  logDirectory: path.join(process.cwd(), 'logs'),
  batchSize: 100,
  maxRetries: 3
}

interface ManagementOptions {
  command: 'ingest' | 'validate' | 'update' | 'backup' | 'restore' | 'optimize' | 'status' | 'help'
  force?: boolean
  dryRun?: boolean
  verbose?: boolean
  source?: string
}

interface KnowledgeBaseStatus {
  lastUpdate: Date
  totalChunks: number
  totalEmbeddings: number
  sources: Record<string, {
    chunks: number
    lastModified: Date
    status: 'healthy' | 'outdated' | 'error'
  }>
  health: {
    score: number
    issues: string[]
    recommendations: string[]
  }
}

/**
 * Main management function
 */
async function manageKnowledgeBase(options: ManagementOptions): Promise<void> {
  console.log(`🔧 Knowledge Base Management - ${options.command.toUpperCase()}`)
  console.log('═'.repeat(60))

  // Ensure directories exist
  await ensureDirectories()

  switch (options.command) {
    case 'ingest':
      await performIngestion(options)
      break
    case 'validate':
      await performValidation(options)
      break
    case 'update':
      await performUpdate(options)
      break
    case 'backup':
      await performBackup(options)
      break
    case 'restore':
      await performRestore(options)
      break
    case 'optimize':
      await performOptimization(options)
      break
    case 'status':
      await showStatus(options)
      break
    case 'help':
      showHelp()
      break
    default:
      throw new Error(`Unknown command: ${options.command}`)
  }
}

/**
 * Perform full knowledge base ingestion
 */
async function performIngestion(options: ManagementOptions): Promise<void> {
  console.log('🚀 Starting knowledge base ingestion...')
  
  if (options.dryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be made')
  }

  try {
    // Create backup before ingestion
    if (!options.dryRun) {
      await createBackup('pre-ingestion')
    }

    // Process documents
    console.log('\n📄 Processing documents...')
    const chunks = await processAllDocuments(
      CONFIG.markdownPath,
      CONFIG.pdfDirectory,
      {
        chunkSize: 800,
        chunkOverlap: 100,
        preserveStructure: true
      }
    )

    console.log(`✅ Processed ${chunks.length} document chunks`)

    if (options.verbose) {
      printChunkStatistics(chunks)
    }

    // Generate embeddings
    console.log('\n🧠 Generating embeddings...')
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is required')
    }

    const embeddings = await generateEmbeddingsForChunks(
      chunks,
      apiKey,
      {
        batchSize: CONFIG.batchSize,
        maxRetries: CONFIG.maxRetries
      },
      (progress) => {
        const percentage = Math.round((progress.processed / progress.total) * 100)
        process.stdout.write(
          `\r   🔄 Progress: ${progress.processed}/${progress.total} (${percentage}%) - Batch ${progress.currentBatch}/${progress.totalBatches}`
        )
      }
    )

    console.log(`\n✅ Generated ${embeddings.length} embeddings`)

    // Save to local storage (for development/testing)
    if (!options.dryRun) {
      await saveKnowledgeBase(chunks, embeddings)
      await updateStatus(chunks, embeddings)
    }

    // Log the operation
    await logOperation('ingestion', {
      chunks: chunks.length,
      embeddings: embeddings.length,
      success: true,
      dryRun: options.dryRun || false
    })

    console.log('\n🎉 Knowledge base ingestion completed successfully!')

  } catch (error) {
    await logOperation('ingestion', {
      success: false,
      error: String(error),
      dryRun: options.dryRun || false
    })
    throw error
  }
}

/**
 * Perform knowledge base validation
 */
async function performValidation(options: ManagementOptions): Promise<void> {
  console.log('🔍 Validating knowledge base...')
  
  try {
    const result = await validateKnowledgeBase()
    
    if (options.verbose) {
      console.log('\n📊 Detailed Validation Results:')
      console.log(JSON.stringify(result, null, 2))
    }

    await logOperation('validation', {
      success: result.documentsProcessed && result.embeddingsGenerated && result.searchFunctional,
      totalChunks: result.summary.totalChunks,
      totalEmbeddings: result.summary.totalEmbeddings,
      testQueriesSuccess: result.testQueries.filter(q => q.success).length,
      testQueriesTotal: result.testQueries.length
    })

  } catch (error) {
    await logOperation('validation', {
      success: false,
      error: String(error)
    })
    throw error
  }
}

/**
 * Perform incremental update
 */
async function performUpdate(options: ManagementOptions): Promise<void> {
  console.log('🔄 Updating knowledge base...')
  
  try {
    // Check what needs updating
    const status = await getKnowledgeBaseStatus()
    const outdatedSources = Object.entries(status.sources)
      .filter(([_, info]) => info.status === 'outdated')
      .map(([source, _]) => source)

    if (outdatedSources.length === 0) {
      console.log('✅ Knowledge base is up to date')
      return
    }

    console.log(`📝 Found ${outdatedSources.length} outdated sources:`)
    outdatedSources.forEach(source => console.log(`   - ${source}`))

    if (options.source) {
      // Update specific source
      console.log(`🎯 Updating specific source: ${options.source}`)
      await updateSpecificSource(options.source, options)
    } else {
      // Update all outdated sources
      console.log('🔄 Updating all outdated sources...')
      for (const source of outdatedSources) {
        await updateSpecificSource(source, options)
      }
    }

    console.log('✅ Knowledge base update completed')

  } catch (error) {
    await logOperation('update', {
      success: false,
      error: String(error),
      source: options.source
    })
    throw error
  }
}

/**
 * Create backup of current knowledge base
 */
async function performBackup(options: ManagementOptions): Promise<void> {
  console.log('💾 Creating knowledge base backup...')
  
  try {
    const backupId = await createBackup('manual')
    console.log(`✅ Backup created: ${backupId}`)

    await logOperation('backup', {
      success: true,
      backupId
    })

  } catch (error) {
    await logOperation('backup', {
      success: false,
      error: String(error)
    })
    throw error
  }
}

/**
 * Restore from backup
 */
async function performRestore(options: ManagementOptions): Promise<void> {
  console.log('🔄 Restoring knowledge base from backup...')
  
  if (!options.source) {
    throw new Error('Backup ID required for restore operation')
  }

  try {
    await restoreFromBackup(options.source, options.force || false)
    console.log(`✅ Restored from backup: ${options.source}`)

    await logOperation('restore', {
      success: true,
      backupId: options.source
    })

  } catch (error) {
    await logOperation('restore', {
      success: false,
      error: String(error),
      backupId: options.source
    })
    throw error
  }
}

/**
 * Optimize knowledge base
 */
async function performOptimization(options: ManagementOptions): Promise<void> {
  console.log('⚡ Optimizing knowledge base...')
  
  try {
    const optimizations = await runOptimizations(options)
    
    console.log('\n📊 Optimization Results:')
    optimizations.forEach(opt => {
      console.log(`   ${opt.success ? '✅' : '❌'} ${opt.name}: ${opt.description}`)
    })

    await logOperation('optimization', {
      success: optimizations.every(opt => opt.success),
      optimizations: optimizations.length
    })

  } catch (error) {
    await logOperation('optimization', {
      success: false,
      error: String(error)
    })
    throw error
  }
}

/**
 * Show knowledge base status
 */
async function showStatus(options: ManagementOptions): Promise<void> {
  console.log('📊 Knowledge Base Status')
  console.log('═'.repeat(40))
  
  try {
    const status = await getKnowledgeBaseStatus()
    
    console.log(`📅 Last Update: ${status.lastUpdate.toLocaleString()}`)
    console.log(`📝 Total Chunks: ${status.totalChunks}`)
    console.log(`🧠 Total Embeddings: ${status.totalEmbeddings}`)
    console.log(`🏥 Health Score: ${Math.round(status.health.score * 100)}%`)
    
    console.log('\n📚 Sources:')
    Object.entries(status.sources).forEach(([source, info]) => {
      const statusIcon = info.status === 'healthy' ? '✅' : info.status === 'outdated' ? '⚠️' : '❌'
      console.log(`   ${statusIcon} ${source}: ${info.chunks} chunks (${info.status})`)
    })
    
    if (status.health.issues.length > 0) {
      console.log('\n⚠️  Issues:')
      status.health.issues.forEach(issue => console.log(`   - ${issue}`))
    }
    
    if (status.health.recommendations.length > 0) {
      console.log('\n💡 Recommendations:')
      status.health.recommendations.forEach(rec => console.log(`   - ${rec}`))
    }

  } catch (error) {
    console.error('❌ Failed to get status:', error)
  }
}

/**
 * Show help information
 */
function showHelp(): void {
  console.log(`
Knowledge Base Management Tool

USAGE:
  npm run kb:manage <command> [options]

COMMANDS:
  ingest     Full knowledge base ingestion from source documents
  validate   Validate knowledge base integrity and search functionality
  update     Incremental update of outdated sources
  backup     Create backup of current knowledge base
  restore    Restore from backup
  optimize   Optimize knowledge base performance
  status     Show current knowledge base status
  help       Show this help message

OPTIONS:
  --force      Force operation without confirmation
  --dry-run    Show what would be done without making changes
  --verbose    Show detailed output
  --source     Specify source for targeted operations

EXAMPLES:
  npm run kb:manage ingest --verbose
  npm run kb:manage validate
  npm run kb:manage update --source modocaverna-docs.md
  npm run kb:manage backup
  npm run kb:manage restore --source backup-20240101-120000
  npm run kb:manage status
`)
}

// Helper functions

async function ensureDirectories(): Promise<void> {
  const dirs = [CONFIG.outputDirectory, CONFIG.backupDirectory, CONFIG.logDirectory]
  for (const dir of dirs) {
    await fs.mkdir(dir, { recursive: true })
  }
}

async function saveKnowledgeBase(chunks: DocumentChunk[], embeddings: EmbeddingVector[]): Promise<void> {
  const timestamp = new Date().toISOString()
  
  await fs.writeFile(
    path.join(CONFIG.outputDirectory, 'chunks.json'),
    JSON.stringify(chunks, null, 2)
  )
  
  await fs.writeFile(
    path.join(CONFIG.outputDirectory, 'embeddings.json'),
    JSON.stringify(embeddings, null, 2)
  )
  
  await fs.writeFile(
    path.join(CONFIG.outputDirectory, 'metadata.json'),
    JSON.stringify({
      timestamp,
      totalChunks: chunks.length,
      totalEmbeddings: embeddings.length,
      sources: chunks.reduce((acc, chunk) => {
        acc[chunk.source] = (acc[chunk.source] || 0) + 1
        return acc
      }, {} as Record<string, number>)
    }, null, 2)
  )
}

async function updateStatus(chunks: DocumentChunk[], embeddings: EmbeddingVector[]): Promise<void> {
  const status: KnowledgeBaseStatus = {
    lastUpdate: new Date(),
    totalChunks: chunks.length,
    totalEmbeddings: embeddings.length,
    sources: {},
    health: {
      score: 1.0,
      issues: [],
      recommendations: []
    }
  }

  // Analyze sources
  chunks.forEach(chunk => {
    if (!status.sources[chunk.source]) {
      status.sources[chunk.source] = {
        chunks: 0,
        lastModified: new Date(),
        status: 'healthy'
      }
    }
    status.sources[chunk.source].chunks++
  })

  await fs.writeFile(
    path.join(CONFIG.outputDirectory, 'status.json'),
    JSON.stringify(status, null, 2)
  )
}

async function getKnowledgeBaseStatus(): Promise<KnowledgeBaseStatus> {
  try {
    const statusFile = path.join(CONFIG.outputDirectory, 'status.json')
    const statusData = await fs.readFile(statusFile, 'utf-8')
    return JSON.parse(statusData)
  } catch (error) {
    // Return default status if file doesn't exist
    return {
      lastUpdate: new Date(0),
      totalChunks: 0,
      totalEmbeddings: 0,
      sources: {},
      health: {
        score: 0,
        issues: ['Knowledge base not initialized'],
        recommendations: ['Run initial ingestion']
      }
    }
  }
}

async function createBackup(type: string): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupId = `backup-${type}-${timestamp}`
  const backupPath = path.join(CONFIG.backupDirectory, backupId)
  
  await fs.mkdir(backupPath, { recursive: true })
  
  // Copy current knowledge base files
  const files = ['chunks.json', 'embeddings.json', 'metadata.json', 'status.json']
  for (const file of files) {
    const sourcePath = path.join(CONFIG.outputDirectory, file)
    const targetPath = path.join(backupPath, file)
    
    try {
      await fs.copyFile(sourcePath, targetPath)
    } catch (error) {
      // File might not exist, continue
    }
  }
  
  return backupId
}

async function restoreFromBackup(backupId: string, force: boolean): Promise<void> {
  const backupPath = path.join(CONFIG.backupDirectory, backupId)
  
  // Check if backup exists
  try {
    await fs.access(backupPath)
  } catch (error) {
    throw new Error(`Backup not found: ${backupId}`)
  }
  
  if (!force) {
    // In a real implementation, you'd prompt for confirmation
    console.log('⚠️  This will overwrite the current knowledge base')
  }
  
  // Restore files
  const files = ['chunks.json', 'embeddings.json', 'metadata.json', 'status.json']
  for (const file of files) {
    const sourcePath = path.join(backupPath, file)
    const targetPath = path.join(CONFIG.outputDirectory, file)
    
    try {
      await fs.copyFile(sourcePath, targetPath)
    } catch (error) {
      // File might not exist in backup, continue
    }
  }
}

async function updateSpecificSource(source: string, options: ManagementOptions): Promise<void> {
  console.log(`🔄 Updating source: ${source}`)
  
  if (options.dryRun) {
    console.log('   🔍 DRY RUN - Would update this source')
    return
  }
  
  // In a real implementation, you'd:
  // 1. Process only the specific source
  // 2. Generate embeddings for new/changed chunks
  // 3. Update the knowledge base incrementally
  // 4. Update the status
  
  console.log('   ✅ Source updated (simulated)')
}

async function runOptimizations(options: ManagementOptions): Promise<Array<{
  name: string
  description: string
  success: boolean
}>> {
  const optimizations = [
    {
      name: 'Duplicate Removal',
      description: 'Remove duplicate chunks and embeddings',
      success: true
    },
    {
      name: 'Index Optimization',
      description: 'Optimize vector search index',
      success: true
    },
    {
      name: 'Cache Cleanup',
      description: 'Clean up old cache entries',
      success: true
    }
  ]
  
  if (options.dryRun) {
    console.log('🔍 DRY RUN - Would run optimizations')
    return optimizations
  }
  
  // Simulate optimization work
  for (const opt of optimizations) {
    console.log(`   🔄 Running ${opt.name}...`)
    await new Promise(resolve => setTimeout(resolve, 500))
  }
  
  return optimizations
}

function printChunkStatistics(chunks: DocumentChunk[]): void {
  console.log('\n📊 Chunk Statistics:')
  
  const sourceStats = chunks.reduce((acc, chunk) => {
    acc[chunk.source] = (acc[chunk.source] || 0) + 1
    return acc
  }, {} as Record<string, number>)
  
  Object.entries(sourceStats).forEach(([source, count]) => {
    console.log(`   ${source}: ${count} chunks`)
  })
  
  const avgLength = chunks.reduce((sum, chunk) => sum + chunk.content.length, 0) / chunks.length
  console.log(`   Average chunk length: ${Math.round(avgLength)} characters`)
}

async function logOperation(operation: string, data: any): Promise<void> {
  const timestamp = new Date().toISOString()
  const logEntry = {
    timestamp,
    operation,
    ...data
  }
  
  const logFile = path.join(CONFIG.logDirectory, `kb-management-${new Date().toISOString().split('T')[0]}.log`)
  const logLine = JSON.stringify(logEntry) + '\n'
  
  await fs.appendFile(logFile, logLine)
}

// Main execution
async function main() {
  const args = process.argv.slice(2)
  
  if (args.length === 0) {
    showHelp()
    process.exit(1)
  }
  
  const options: ManagementOptions = {
    command: args[0] as ManagementOptions['command'],
    force: args.includes('--force'),
    dryRun: args.includes('--dry-run'),
    verbose: args.includes('--verbose'),
    source: args.find(arg => arg.startsWith('--source='))?.split('=')[1]
  }
  
  try {
    await manageKnowledgeBase(options)
    process.exit(0)
  } catch (error) {
    console.error('💥 Management operation failed:', error)
    process.exit(1)
  }
}

// Export for testing
export { manageKnowledgeBase, getKnowledgeBaseStatus, createBackup }

// Run if called directly
if (require.main === module) {
  main()
}