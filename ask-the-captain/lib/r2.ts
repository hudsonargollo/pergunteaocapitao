import { v4 as uuidv4 } from 'uuid'
import type { ImageStorageMetadata, ImageUploadResult, ImageStorageError } from '@/types'

/**
 * Custom error class for R2 storage operations
 */
export class R2StorageError extends Error {
  constructor(
    message: string,
    public code: string,
    public operation: string,
    public originalError?: Error
  ) {
    super(message)
    this.name = 'R2StorageError'
  }
}

/**
 * R2 operation result wrapper
 */
export interface R2OperationResult<T = any> {
  success: boolean
  data?: T
  error?: R2StorageError
  meta?: {
    duration: number
    size?: number
    etag?: string
  }
}

/**
 * Enhanced R2 client for image storage and retrieval with comprehensive error handling
 */
export class R2Client {
  private readonly bucketName: string
  private readonly publicDomain?: string

  constructor(
    private bucket: R2Bucket, 
    bucketName: string,
    publicDomain?: string
  ) {
    this.bucketName = bucketName
    this.publicDomain = publicDomain
  }

  /**
   * Execute R2 operation with error handling and timing
   */
  private async executeOperation<T>(
    operation: string,
    operationFn: () => Promise<T>
  ): Promise<R2OperationResult<T>> {
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
      const r2Error = error instanceof R2StorageError 
        ? error 
        : new R2StorageError(
            `R2 operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            'OPERATION_ERROR',
            operation,
            error instanceof Error ? error : undefined
          )
      
      console.error(`R2 ${operation} failed:`, {
        error: r2Error.message,
        code: r2Error.code,
        duration,
        originalError: r2Error.originalError
      })
      
      return {
        success: false,
        error: r2Error,
        meta: { duration }
      }
    }
  }

  /**
   * Generate unique image identifier
   */
  generateImageId(): string {
    return uuidv4()
  }

  /**
   * Generate organized R2 key for image storage
   */
  generateImageKey(imageId: string, extension: string = 'png'): string {
    if (!imageId?.trim()) {
      throw new R2StorageError('Image ID is required', 'VALIDATION_ERROR', 'generateImageKey')
    }

    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    
    return `images/generated/${year}/${month}/${imageId}.${extension}`
  }

  /**
   * Generate fallback image key
   */
  generateFallbackKey(type: 'default' | 'loading' | 'error'): string {
    return `images/fallbacks/${type}-captain.png`
  }

  /**
   * Upload image with comprehensive metadata and validation
   */
  async uploadImage(
    imageBuffer: ArrayBuffer,
    metadata: ImageStorageMetadata
  ): Promise<R2OperationResult<ImageUploadResult>> {
    if (!imageBuffer || imageBuffer.byteLength === 0) {
      return {
        success: false,
        error: new R2StorageError('Image buffer is required and cannot be empty', 'VALIDATION_ERROR', 'uploadImage')
      }
    }

    if (!metadata.imageId) {
      return {
        success: false,
        error: new R2StorageError('Image ID is required in metadata', 'VALIDATION_ERROR', 'uploadImage')
      }
    }

    return this.executeOperation('uploadImage', async () => {
      const key = this.generateImageKey(metadata.imageId)
      const size = imageBuffer.byteLength
      
      // Prepare custom metadata for R2
      const customMetadata: Record<string, string> = {
        imageId: metadata.imageId,
        promptParameters: JSON.stringify(metadata.promptParameters || {}),
        toneAnalysis: JSON.stringify(metadata.toneAnalysis || {}),
        uploadedAt: new Date().toISOString(),
        size: size.toString()
      }

      if (metadata.responseContext) {
        customMetadata.responseContext = metadata.responseContext
      }

      // Upload to R2
      const putResult = await this.bucket.put(key, imageBuffer, {
        httpMetadata: {
          contentType: 'image/png',
          cacheControl: 'public, max-age=31536000', // 1 year cache
        },
        customMetadata
      })

      if (!putResult) {
        throw new R2StorageError('Failed to upload image to R2', 'UPLOAD_ERROR', 'uploadImage')
      }

      const publicUrl = this.getPublicUrl(key)

      return {
        imageId: metadata.imageId,
        r2ObjectKey: key,
        publicUrl,
        size,
        etag: putResult.etag,
        uploadedAt: new Date().toISOString()
      }
    })
  }

  /**
   * Retrieve image as ArrayBuffer
   */
  async getImage(key: string): Promise<R2OperationResult<ArrayBuffer | null>> {
    if (!key?.trim()) {
      return {
        success: false,
        error: new R2StorageError('R2 key is required', 'VALIDATION_ERROR', 'getImage')
      }
    }

    return this.executeOperation('getImage', async () => {
      const object = await this.bucket.get(key)
      if (!object) return null
      
      return await object.arrayBuffer()
    })
  }

  /**
   * Get public URL for image
   */
  getPublicUrl(key: string): string {
    if (!key?.trim()) {
      throw new R2StorageError('R2 key is required', 'VALIDATION_ERROR', 'getPublicUrl')
    }

    if (this.publicDomain) {
      return `https://${this.publicDomain}/${key}`
    }
    
    // Fallback to default R2 public URL format
    return `https://${this.bucketName}.r2.dev/${key}`
  }

  /**
   * Check if image exists
   */
  async imageExists(key: string): Promise<R2OperationResult<boolean>> {
    if (!key?.trim()) {
      return {
        success: false,
        error: new R2StorageError('R2 key is required', 'VALIDATION_ERROR', 'imageExists')
      }
    }

    return this.executeOperation('imageExists', async () => {
      const object = await this.bucket.head(key)
      return object !== null
    })
  }

  /**
   * Delete image from R2
   */
  async deleteImage(key: string): Promise<R2OperationResult<boolean>> {
    if (!key?.trim()) {
      return {
        success: false,
        error: new R2StorageError('R2 key is required', 'VALIDATION_ERROR', 'deleteImage')
      }
    }

    return this.executeOperation('deleteImage', async () => {
      await this.bucket.delete(key)
      
      // Verify deletion by checking if object still exists
      const stillExists = await this.bucket.head(key)
      return stillExists === null
    })
  }

  /**
   * List images with filtering and pagination
   */
  async listImages(options: {
    prefix?: string
    limit?: number
    cursor?: string
  } = {}): Promise<R2OperationResult<{
    keys: string[]
    truncated: boolean
    cursor?: string
  }>> {
    const { prefix, limit = 100, cursor } = options

    if (limit <= 0 || limit > 1000) {
      return {
        success: false,
        error: new R2StorageError('Limit must be between 1 and 1000', 'VALIDATION_ERROR', 'listImages')
      }
    }

    return this.executeOperation('listImages', async () => {
      const listOptions: R2ListOptions = { limit }
      if (prefix) listOptions.prefix = prefix
      if (cursor) listOptions.cursor = cursor

      const listing = await this.bucket.list(listOptions)
      
      return {
        keys: listing.objects.map(obj => obj.key),
        truncated: listing.truncated,
        cursor: listing.truncated ? 'next-page' : undefined
      }
    })
  }

  /**
   * Get comprehensive image metadata from R2
   */
  async getImageMetadata(key: string): Promise<R2OperationResult<ImageStorageMetadata | null>> {
    if (!key?.trim()) {
      return {
        success: false,
        error: new R2StorageError('R2 key is required', 'VALIDATION_ERROR', 'getImageMetadata')
      }
    }

    return this.executeOperation('getImageMetadata', async () => {
      const object = await this.bucket.head(key)
      if (!object) return null
      
      const customMetadata = object.customMetadata || {}
      
      return {
        imageId: customMetadata.imageId || '',
        promptParameters: customMetadata.promptParameters ? JSON.parse(customMetadata.promptParameters) : {},
        toneAnalysis: customMetadata.toneAnalysis ? JSON.parse(customMetadata.toneAnalysis) : {},
        responseContext: customMetadata.responseContext,
        uploadedAt: customMetadata.uploadedAt,
        size: customMetadata.size ? parseInt(customMetadata.size) : object.size
      }
    })
  }

  /**
   * Get storage statistics
   */
  async getStorageStats(): Promise<R2OperationResult<{
    totalImages: number
    totalSize: number
    generatedImages: number
    fallbackImages: number
  }>> {
    return this.executeOperation('getStorageStats', async () => {
      // List all images
      const allImagesResult = await this.bucket.list({ prefix: 'images/' })
      const generatedImagesResult = await this.bucket.list({ prefix: 'images/generated/' })
      const fallbackImagesResult = await this.bucket.list({ prefix: 'images/fallbacks/' })
      
      const totalSize = allImagesResult.objects.reduce((sum, obj) => sum + (obj.size || 0), 0)
      
      return {
        totalImages: allImagesResult.objects.length,
        totalSize,
        generatedImages: generatedImagesResult.objects.length,
        fallbackImages: fallbackImagesResult.objects.length
      }
    })
  }

  /**
   * Cleanup old images based on age
   */
  async cleanupOldImages(olderThanDays: number = 30): Promise<R2OperationResult<{
    deletedCount: number
    deletedKeys: string[]
    errors: string[]
  }>> {
    if (olderThanDays <= 0) {
      return {
        success: false,
        error: new R2StorageError('Days must be greater than 0', 'VALIDATION_ERROR', 'cleanupOldImages')
      }
    }

    return this.executeOperation('cleanupOldImages', async () => {
      const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000)
      const listing = await this.bucket.list({ prefix: 'images/generated/' })
      
      const deletedKeys: string[] = []
      const errors: string[] = []
      
      for (const object of listing.objects) {
        if (object.uploaded && object.uploaded < cutoffDate) {
          try {
            await this.bucket.delete(object.key)
            deletedKeys.push(object.key)
          } catch (error) {
            errors.push(`Failed to delete ${object.key}: ${error instanceof Error ? error.message : 'Unknown error'}`)
          }
        }
      }
      
      return {
        deletedCount: deletedKeys.length,
        deletedKeys,
        errors
      }
    })
  }

  /**
   * Health check for R2 bucket
   */
  async healthCheck(): Promise<R2OperationResult<{
    status: 'healthy' | 'unhealthy'
    timestamp: string
    latency: number
    canRead: boolean
    canWrite: boolean
  }>> {
    const startTime = Date.now()
    
    return this.executeOperation('healthCheck', async () => {
      let canRead = false
      let canWrite = false
      
      try {
        // Test read operation
        await this.bucket.list({ limit: 1 })
        canRead = true
        
        // Test write operation with a small test file
        const testKey = `health-check/test-${Date.now()}.txt`
        const testData = new TextEncoder().encode('health-check')
        
        await this.bucket.put(testKey, testData)
        canWrite = true
        
        // Clean up test file
        await this.bucket.delete(testKey)
      } catch (error) {
        // Errors are handled by the outer executeOperation
        throw error
      }
      
      const latency = Date.now() - startTime
      const status = canRead && canWrite ? 'healthy' : 'unhealthy'
      
      return {
        status,
        timestamp: new Date().toISOString(),
        latency,
        canRead,
        canWrite
      }
    })
  }
}

/**
 * Factory function to create R2Client instance
 */
export function createR2Client(
  bucket: R2Bucket, 
  bucketName: string,
  publicDomain?: string
): R2Client {
  return new R2Client(bucket, bucketName, publicDomain)
}

/**
 * Helper function to handle R2 operation results
 */
export function handleR2Result<T>(
  result: R2OperationResult<T>,
  operation: string
): T {
  if (!result.success) {
    throw result.error || new R2StorageError(
      `Operation ${operation} failed`,
      'UNKNOWN_ERROR',
      operation
    )
  }
  
  return result.data as T
}