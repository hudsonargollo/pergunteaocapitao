// Cloudflare D1 database operations with enhanced error handling and connection management
import type { GeneratedImage, Conversation } from '@/types'

/**
 * Custom error class for database operations
 */
export class D1Error extends Error {
  constructor(
    message: string,
    public code: string,
    public operation: string,
    public originalError?: Error
  ) {
    super(message)
    this.name = 'D1Error'
  }
}

/**
 * Database query result wrapper
 */
export interface QueryResult<T = any> {
  success: boolean
  data?: T
  error?: D1Error
  meta?: {
    duration: number
    changes?: number
    last_row_id?: number
  }
}

/**
 * Enhanced D1 client with connection management and error handling
 */
export class D1Client {
  private connectionHealthy: boolean = true
  private lastHealthCheck: number = 0
  private readonly HEALTH_CHECK_INTERVAL = 30000 // 30 seconds

  constructor(private db: D1Database) {
    this.validateConnection()
  }

  /**
   * Validate database connection
   */
  private async validateConnection(): Promise<void> {
    try {
      await this.db.prepare('SELECT 1').first()
      this.connectionHealthy = true
      this.lastHealthCheck = Date.now()
    } catch (error) {
      this.connectionHealthy = false
      console.error('D1 connection validation failed:', error)
    }
  }

  /**
   * Check connection health with caching
   */
  private async ensureConnection(): Promise<void> {
    const now = Date.now()
    if (now - this.lastHealthCheck > this.HEALTH_CHECK_INTERVAL) {
      await this.validateConnection()
    }
    
    if (!this.connectionHealthy) {
      throw new D1Error(
        'Database connection is not healthy',
        'CONNECTION_ERROR',
        'health_check'
      )
    }
  }

  /**
   * Disable health checks for testing
   */
  public disableHealthChecks(): void {
    this.connectionHealthy = true
    this.lastHealthCheck = Date.now()
  }

  /**
   * Execute query with error handling and timing
   */
  private async executeQuery<T>(
    operation: string,
    queryFn: () => Promise<T>
  ): Promise<QueryResult<T>> {
    const startTime = Date.now()
    
    try {
      await this.ensureConnection()
      const data = await queryFn()
      const duration = Date.now() - startTime
      
      return {
        success: true,
        data,
        meta: { duration }
      }
    } catch (error) {
      const duration = Date.now() - startTime
      const d1Error = error instanceof D1Error 
        ? error 
        : new D1Error(
            `Database operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            'QUERY_ERROR',
            operation,
            error instanceof Error ? error : undefined
          )
      
      console.error(`D1 ${operation} failed:`, {
        error: d1Error.message,
        code: d1Error.code,
        duration,
        originalError: d1Error.originalError
      })
      
      return {
        success: false,
        error: d1Error,
        meta: { duration }
      }
    }
  }

  /**
   * Execute batch operations with transaction support
   */
  private async executeBatch(
    operation: string,
    statements: D1PreparedStatement[]
  ): Promise<QueryResult<D1Result[]>> {
    return this.executeQuery(operation, async () => {
      const results = await this.db.batch(statements)
      return results
    })
  }

  // ===== Generated Images Operations =====

  /**
   * Create a new generated image record
   */
  async createGeneratedImage(image: Omit<GeneratedImage, 'created_at'>): Promise<QueryResult<void>> {
    return this.executeQuery('createGeneratedImage', async () => {
      const result = await this.db
        .prepare(
          `INSERT INTO GeneratedImages (image_id, r2_object_key, prompt_parameters, response_context, tone_analysis)
           VALUES (?, ?, ?, ?, ?)`
        )
        .bind(
          image.image_id,
          image.r2_object_key,
          image.prompt_parameters,
          image.response_context || null,
          image.tone_analysis || null
        )
        .run()
      
      if (!result.success) {
        throw new D1Error(
          'Failed to insert generated image',
          'INSERT_ERROR',
          'createGeneratedImage'
        )
      }
    })
  }

  /**
   * Get a generated image by ID
   */
  async getGeneratedImage(imageId: string): Promise<QueryResult<GeneratedImage | null>> {
    if (!imageId?.trim()) {
      return {
        success: false,
        error: new D1Error('Image ID is required', 'VALIDATION_ERROR', 'getGeneratedImage')
      }
    }

    return this.executeQuery('getGeneratedImage', async () => {
      const result = await this.db
        .prepare('SELECT * FROM GeneratedImages WHERE image_id = ?')
        .bind(imageId)
        .first<GeneratedImage>()
      
      return result || null
    })
  }

  /**
   * Get recent generated images
   */
  async getRecentGeneratedImages(limit: number = 10): Promise<QueryResult<GeneratedImage[]>> {
    if (limit <= 0 || limit > 100) {
      return {
        success: false,
        error: new D1Error('Limit must be between 1 and 100', 'VALIDATION_ERROR', 'getRecentGeneratedImages')
      }
    }

    return this.executeQuery('getRecentGeneratedImages', async () => {
      const results = await this.db
        .prepare('SELECT * FROM GeneratedImages ORDER BY created_at DESC LIMIT ?')
        .bind(limit)
        .all<GeneratedImage>()
      
      return results.results || []
    })
  }

  /**
   * Delete a generated image record
   */
  async deleteGeneratedImage(imageId: string): Promise<QueryResult<boolean>> {
    if (!imageId?.trim()) {
      return {
        success: false,
        error: new D1Error('Image ID is required', 'VALIDATION_ERROR', 'deleteGeneratedImage')
      }
    }

    return this.executeQuery('deleteGeneratedImage', async () => {
      const result = await this.db
        .prepare('DELETE FROM GeneratedImages WHERE image_id = ?')
        .bind(imageId)
        .run()
      
      return (result.meta?.changes || 0) > 0
    })
  }

  // ===== Conversation Operations =====

  /**
   * Create a new conversation record
   */
  async createConversation(conversation: Omit<Conversation, 'created_at'>): Promise<QueryResult<void>> {
    return this.executeQuery('createConversation', async () => {
      const result = await this.db
        .prepare(
          `INSERT INTO Conversations (id, user_id, message, response, image_id, embedding_query, search_results)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          conversation.id,
          conversation.user_id || null,
          conversation.message,
          conversation.response,
          conversation.image_id || null,
          conversation.embedding_query || null,
          conversation.search_results || null
        )
        .run()
      
      if (!result.success) {
        throw new D1Error(
          'Failed to insert conversation',
          'INSERT_ERROR',
          'createConversation'
        )
      }
    })
  }

  /**
   * Get a conversation by ID
   */
  async getConversation(id: string): Promise<QueryResult<Conversation | null>> {
    if (!id?.trim()) {
      return {
        success: false,
        error: new D1Error('Conversation ID is required', 'VALIDATION_ERROR', 'getConversation')
      }
    }

    return this.executeQuery('getConversation', async () => {
      const result = await this.db
        .prepare('SELECT * FROM Conversations WHERE id = ?')
        .bind(id)
        .first<Conversation>()
      
      return result || null
    })
  }

  /**
   * Get recent conversations with optional user filtering
   */
  async getRecentConversations(
    limit: number = 10, 
    userId?: string
  ): Promise<QueryResult<Conversation[]>> {
    if (limit <= 0 || limit > 100) {
      return {
        success: false,
        error: new D1Error('Limit must be between 1 and 100', 'VALIDATION_ERROR', 'getRecentConversations')
      }
    }

    return this.executeQuery('getRecentConversations', async () => {
      let query = 'SELECT * FROM Conversations'
      const params: any[] = []
      
      if (userId) {
        query += ' WHERE user_id = ?'
        params.push(userId)
      }
      
      query += ' ORDER BY created_at DESC LIMIT ?'
      params.push(limit)
      
      const results = await this.db
        .prepare(query)
        .bind(...params)
        .all<Conversation>()
      
      return results.results || []
    })
  }

  /**
   * Get conversations by image ID
   */
  async getConversationsByImage(imageId: string): Promise<QueryResult<Conversation[]>> {
    if (!imageId?.trim()) {
      return {
        success: false,
        error: new D1Error('Image ID is required', 'VALIDATION_ERROR', 'getConversationsByImage')
      }
    }

    return this.executeQuery('getConversationsByImage', async () => {
      const results = await this.db
        .prepare('SELECT * FROM Conversations WHERE image_id = ? ORDER BY created_at DESC')
        .bind(imageId)
        .all<Conversation>()
      
      return results.results || []
    })
  }

  // ===== Utility Operations =====

  /**
   * Get database statistics
   */
  async getStats(): Promise<QueryResult<{
    totalImages: number
    totalConversations: number
    recentActivity: {
      imagesLast24h: number
      conversationsLast24h: number
    }
  }>> {
    return this.executeQuery('getStats', async () => {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      
      const [totalImages, totalConversations, recentImages, recentConversations] = await Promise.all([
        this.db.prepare('SELECT COUNT(*) as count FROM GeneratedImages').first<{count: number}>(),
        this.db.prepare('SELECT COUNT(*) as count FROM Conversations').first<{count: number}>(),
        this.db.prepare('SELECT COUNT(*) as count FROM GeneratedImages WHERE created_at > ?').bind(yesterday).first<{count: number}>(),
        this.db.prepare('SELECT COUNT(*) as count FROM Conversations WHERE created_at > ?').bind(yesterday).first<{count: number}>()
      ])
      
      return {
        totalImages: totalImages?.count || 0,
        totalConversations: totalConversations?.count || 0,
        recentActivity: {
          imagesLast24h: recentImages?.count || 0,
          conversationsLast24h: recentConversations?.count || 0
        }
      }
    })
  }

  /**
   * Health check for the database connection
   */
  async healthCheck(): Promise<QueryResult<{
    status: 'healthy' | 'unhealthy'
    timestamp: string
    latency: number
  }>> {
    const startTime = Date.now()
    
    return this.executeQuery('healthCheck', async () => {
      await this.db.prepare('SELECT 1 as test').first()
      const latency = Date.now() - startTime
      
      return {
        status: 'healthy' as const,
        timestamp: new Date().toISOString(),
        latency
      }
    })
  }
}

/**
 * Factory function to create D1Client instance
 */
export function createD1Client(database: D1Database): D1Client {
  return new D1Client(database)
}

/**
 * Helper function to handle D1 query results
 */
export function handleQueryResult<T>(
  result: QueryResult<T>,
  operation: string
): T {
  if (!result.success) {
    throw result.error || new D1Error(
      `Operation ${operation} failed`,
      'UNKNOWN_ERROR',
      operation
    )
  }
  
  return result.data as T
}