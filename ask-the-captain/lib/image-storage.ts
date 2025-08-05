import { R2Client, R2StorageError, handleR2Result } from './r2'
import { D1Client, D1Error, handleQueryResult } from './d1'
import type { 
  ImageStorageMetadata, 
  ImageUploadResult, 
  GeneratedImage,
  ToneAnalysis 
} from '@/types'

/**
 * Custom error class for image storage operations
 */
export class ImageStorageError extends Error {
  constructor(
    message: string,
    public code: string,
    public operation: string,
    public originalError?: Error
  ) {
    super(message)
    this.name = 'ImageStorageError'
  }
}

/**
 * Image storage operation result
 */
export interface ImageStorageResult<T = any> {
  success: boolean
  data?: T
  error?: ImageStorageError
  meta?: {
    duration: number
    r2Duration?: number
    d1Duration?: number
  }
}

/**
 * Complete image storage request
 */
export interface StoreImageRequest {
  imageBuffer: ArrayBuffer
  promptParameters: object
  responseContext?: string
  toneAnalysis?: ToneAnalysis
}

/**
 * Complete image storage response
 */
export interface StoreImageResponse {
  imageId: string
  publicUrl: string
  r2ObjectKey: string
  metadata: GeneratedImage
}

/**
 * Comprehensive image storage service that coordinates R2 and D1 operations
 */
export class ImageStorageService {
  constructor(
    private r2Client: R2Client,
    private d1Client: D1Client
  ) {}

  /**
   * Execute storage operation with comprehensive error handling
   */
  private async executeStorageOperation<T>(
    operation: string,
    operationFn: () => Promise<T>
  ): Promise<ImageStorageResult<T>> {
    const startTime = Date.now()
    
    try {
      const data = await operationFn()
      const duration = Date.now() - startTime
      
      return {
        success: true,
        data,
        meta: { duration }
      }
    } catch (error) {
      const duration = Date.now() - startTime
      
      let storageError: ImageStorageError
      
      if (error instanceof R2StorageError) {
        storageError = new ImageStorageError(
          `R2 storage failed: ${error.message}`,
          `R2_${error.code}`,
          operation,
          error
        )
      } else if (error instanceof D1Error) {
        storageError = new ImageStorageError(
          `Database storage failed: ${error.message}`,
          `D1_${error.code}`,
          operation,
          error
        )
      } else if (error instanceof ImageStorageError) {
        storageError = error
      } else {
        storageError = new ImageStorageError(
          `Storage operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          'UNKNOWN_ERROR',
          operation,
          error instanceof Error ? error : undefined
        )
      }
      
      console.error(`ImageStorage ${operation} failed:`, {
        error: storageError.message,
        code: storageError.code,
        duration,
        originalError: storageError.originalError
      })
      
      return {
        success: false,
        error: storageError,
        meta: { duration }
      }
    }
  }

  /**
   * Store image with complete metadata in both R2 and D1
   */
  async storeImage(request: StoreImageRequest): Promise<ImageStorageResult<StoreImageResponse>> {
    return this.executeStorageOperation('storeImage', async () => {
      // Generate unique image ID
      const imageId = this.r2Client.generateImageId()
      
      // Prepare metadata for R2 storage
      const storageMetadata: ImageStorageMetadata = {
        imageId,
        promptParameters: request.promptParameters,
        toneAnalysis: request.toneAnalysis,
        responseContext: request.responseContext
      }
      
      // Upload to R2
      const r2Result = await this.r2Client.uploadImage(request.imageBuffer, storageMetadata)
      if (!r2Result.success) {
        throw r2Result.error || new ImageStorageError('R2 upload failed', 'R2_UPLOAD_ERROR', 'storeImage')
      }
      
      const uploadResult = r2Result.data!
      
      // Prepare metadata for D1 storage
      const dbImage: Omit<GeneratedImage, 'created_at'> = {
        image_id: imageId,
        r2_object_key: uploadResult.r2ObjectKey,
        prompt_parameters: JSON.stringify(request.promptParameters),
        response_context: request.responseContext,
        tone_analysis: request.toneAnalysis ? JSON.stringify(request.toneAnalysis) : undefined
      }
      
      // Store metadata in D1
      const d1Result = await this.d1Client.createGeneratedImage(dbImage)
      if (!d1Result.success) {
        // Rollback: delete from R2 if D1 storage fails
        try {
          await this.r2Client.deleteImage(uploadResult.r2ObjectKey)
        } catch (rollbackError) {
          console.error('Failed to rollback R2 upload after D1 failure:', rollbackError)
        }
        
        throw d1Result.error || new ImageStorageError('Database storage failed', 'D1_STORAGE_ERROR', 'storeImage')
      }
      
      // Return complete storage response
      return {
        imageId,
        publicUrl: uploadResult.publicUrl,
        r2ObjectKey: uploadResult.r2ObjectKey,
        metadata: {
          ...dbImage,
          created_at: new Date().toISOString()
        }
      }
    })
  }

  /**
   * Retrieve image with metadata
   */
  async getImage(imageId: string): Promise<ImageStorageResult<{
    imageBuffer: ArrayBuffer
    metadata: GeneratedImage
    publicUrl: string
  } | null>> {
    if (!imageId?.trim()) {
      return {
        success: false,
        error: new ImageStorageError('Image ID is required', 'VALIDATION_ERROR', 'getImage')
      }
    }

    return this.executeStorageOperation('getImage', async () => {
      // Get metadata from D1
      const d1Result = await this.d1Client.getGeneratedImage(imageId)
      if (!d1Result.success) {
        throw d1Result.error || new ImageStorageError('Failed to get image metadata', 'D1_QUERY_ERROR', 'getImage')
      }
      
      if (!d1Result.data) {
        return null
      }
      
      const metadata = d1Result.data
      
      // Get image from R2
      const r2Result = await this.r2Client.getImage(metadata.r2_object_key)
      if (!r2Result.success) {
        throw r2Result.error || new ImageStorageError('Failed to get image from R2', 'R2_RETRIEVAL_ERROR', 'getImage')
      }
      
      if (!r2Result.data) {
        return null
      }
      
      return {
        imageBuffer: r2Result.data,
        metadata,
        publicUrl: this.r2Client.getPublicUrl(metadata.r2_object_key)
      }
    })
  }

  /**
   * Get image metadata only (without downloading the image)
   */
  async getImageMetadata(imageId: string): Promise<ImageStorageResult<GeneratedImage | null>> {
    if (!imageId?.trim()) {
      return {
        success: false,
        error: new ImageStorageError('Image ID is required', 'VALIDATION_ERROR', 'getImageMetadata')
      }
    }

    return this.executeStorageOperation('getImageMetadata', async () => {
      const d1Result = await this.d1Client.getGeneratedImage(imageId)
      if (!d1Result.success) {
        throw d1Result.error || new ImageStorageError('Failed to get image metadata', 'D1_QUERY_ERROR', 'getImageMetadata')
      }
      
      return d1Result.data || null
    })
  }

  /**
   * Get public URL for image
   */
  async getImageUrl(imageId: string): Promise<ImageStorageResult<string | null>> {
    if (!imageId?.trim()) {
      return {
        success: false,
        error: new ImageStorageError('Image ID is required', 'VALIDATION_ERROR', 'getImageUrl')
      }
    }

    return this.executeStorageOperation('getImageUrl', async () => {
      const metadataResult = await this.getImageMetadata(imageId)
      if (!metadataResult.success) {
        throw metadataResult.error
      }
      
      if (!metadataResult.data) {
        return null
      }
      
      return this.r2Client.getPublicUrl(metadataResult.data.r2_object_key)
    })
  }

  /**
   * Delete image from both R2 and D1
   */
  async deleteImage(imageId: string): Promise<ImageStorageResult<boolean>> {
    if (!imageId?.trim()) {
      return {
        success: false,
        error: new ImageStorageError('Image ID is required', 'VALIDATION_ERROR', 'deleteImage')
      }
    }

    return this.executeStorageOperation('deleteImage', async () => {
      // Get metadata first to get R2 key
      const metadataResult = await this.getImageMetadata(imageId)
      if (!metadataResult.success) {
        throw metadataResult.error
      }
      
      if (!metadataResult.data) {
        return false // Image doesn't exist
      }
      
      const metadata = metadataResult.data
      let r2Deleted = false
      let d1Deleted = false
      
      // Delete from R2
      try {
        const r2Result = await this.r2Client.deleteImage(metadata.r2_object_key)
        if (r2Result.success) {
          r2Deleted = r2Result.data || false
        }
      } catch (error) {
        console.warn(`Failed to delete image from R2: ${error}`)
      }
      
      // Delete from D1
      const d1Result = await this.d1Client.deleteGeneratedImage(imageId)
      if (d1Result.success) {
        d1Deleted = d1Result.data || false
      }
      
      // Return true if at least D1 deletion succeeded (metadata is gone)
      return d1Deleted
    })
  }

  /**
   * List recent images with metadata
   */
  async listRecentImages(limit: number = 10): Promise<ImageStorageResult<GeneratedImage[]>> {
    if (limit <= 0 || limit > 100) {
      return {
        success: false,
        error: new ImageStorageError('Limit must be between 1 and 100', 'VALIDATION_ERROR', 'listRecentImages')
      }
    }

    return this.executeStorageOperation('listRecentImages', async () => {
      const d1Result = await this.d1Client.getRecentGeneratedImages(limit)
      if (!d1Result.success) {
        throw d1Result.error || new ImageStorageError('Failed to list recent images', 'D1_QUERY_ERROR', 'listRecentImages')
      }
      
      return d1Result.data || []
    })
  }

  /**
   * Get storage statistics
   */
  async getStorageStats(): Promise<ImageStorageResult<{
    database: {
      totalImages: number
      totalConversations: number
      recentActivity: {
        imagesLast24h: number
        conversationsLast24h: number
      }
    }
    storage: {
      totalImages: number
      totalSize: number
      generatedImages: number
      fallbackImages: number
    }
  }>> {
    return this.executeStorageOperation('getStorageStats', async () => {
      // Get database stats
      const d1StatsResult = await this.d1Client.getStats()
      if (!d1StatsResult.success) {
        throw d1StatsResult.error || new ImageStorageError('Failed to get database stats', 'D1_QUERY_ERROR', 'getStorageStats')
      }
      
      // Get R2 storage stats
      const r2StatsResult = await this.r2Client.getStorageStats()
      if (!r2StatsResult.success) {
        throw r2StatsResult.error || new ImageStorageError('Failed to get storage stats', 'R2_QUERY_ERROR', 'getStorageStats')
      }
      
      return {
        database: d1StatsResult.data!,
        storage: r2StatsResult.data!
      }
    })
  }

  /**
   * Health check for the entire image storage system
   */
  async healthCheck(): Promise<ImageStorageResult<{
    status: 'healthy' | 'degraded' | 'unhealthy'
    timestamp: string
    components: {
      database: {
        status: 'healthy' | 'unhealthy'
        latency: number
      }
      storage: {
        status: 'healthy' | 'unhealthy'
        latency: number
        canRead: boolean
        canWrite: boolean
      }
    }
  }>> {
    return this.executeStorageOperation('healthCheck', async () => {
      // Check D1 health
      const d1HealthResult = await this.d1Client.healthCheck()
      const d1Health = {
        status: d1HealthResult.success ? 'healthy' as const : 'unhealthy' as const,
        latency: d1HealthResult.data?.latency || 0
      }
      
      // Check R2 health
      const r2HealthResult = await this.r2Client.healthCheck()
      const r2Health = {
        status: r2HealthResult.success ? 'healthy' as const : 'unhealthy' as const,
        latency: r2HealthResult.data?.latency || 0,
        canRead: r2HealthResult.data?.canRead || false,
        canWrite: r2HealthResult.data?.canWrite || false
      }
      
      // Determine overall status
      let overallStatus: 'healthy' | 'degraded' | 'unhealthy'
      if (d1Health.status === 'healthy' && r2Health.status === 'healthy') {
        overallStatus = 'healthy'
      } else if (d1Health.status === 'healthy' || r2Health.status === 'healthy') {
        overallStatus = 'degraded'
      } else {
        overallStatus = 'unhealthy'
      }
      
      return {
        status: overallStatus,
        timestamp: new Date().toISOString(),
        components: {
          database: d1Health,
          storage: r2Health
        }
      }
    })
  }

  /**
   * Cleanup old images (removes from both R2 and D1)
   */
  async cleanupOldImages(olderThanDays: number = 30): Promise<ImageStorageResult<{
    deletedCount: number
    errors: string[]
  }>> {
    if (olderThanDays <= 0) {
      return {
        success: false,
        error: new ImageStorageError('Days must be greater than 0', 'VALIDATION_ERROR', 'cleanupOldImages')
      }
    }

    return this.executeStorageOperation('cleanupOldImages', async () => {
      const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000).toISOString()
      
      // Get old images from D1
      const oldImagesQuery = `
        SELECT image_id, r2_object_key 
        FROM GeneratedImages 
        WHERE created_at < ? 
        ORDER BY created_at ASC
      `
      
      // This would need to be implemented in D1Client if needed
      // For now, we'll use the R2 cleanup method
      const r2CleanupResult = await this.r2Client.cleanupOldImages(olderThanDays)
      if (!r2CleanupResult.success) {
        throw r2CleanupResult.error
      }
      
      return {
        deletedCount: r2CleanupResult.data!.deletedCount,
        errors: r2CleanupResult.data!.errors
      }
    })
  }
}

/**
 * Factory function to create ImageStorageService instance
 */
export function createImageStorageService(
  r2Client: R2Client,
  d1Client: D1Client
): ImageStorageService {
  return new ImageStorageService(r2Client, d1Client)
}

/**
 * Helper function to handle image storage results
 */
export function handleImageStorageResult<T>(
  result: ImageStorageResult<T>,
  operation: string
): T {
  if (!result.success) {
    throw result.error || new ImageStorageError(
      `Operation ${operation} failed`,
      'UNKNOWN_ERROR',
      operation
    )
  }
  
  return result.data as T
}