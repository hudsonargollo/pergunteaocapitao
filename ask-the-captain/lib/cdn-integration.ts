/**
 * CDN Integration for Cloudflare R2 and Image Optimization
 * Provides CDN caching, image optimization, and cache control headers
 */

import type { CloudflareEnv } from '@/types'

export interface CDNOptions {
  cacheControl: string
  maxAge: number
  staleWhileRevalidate: number
  imageOptimization: boolean
  compressionLevel: number
}

export interface ImageTransformOptions {
  width?: number
  height?: number
  quality?: number
  format?: 'webp' | 'avif' | 'jpeg' | 'png'
  fit?: 'scale-down' | 'contain' | 'cover' | 'crop' | 'pad'
}

export interface CDNResponse {
  url: string
  headers: Record<string, string>
  cacheStatus: 'hit' | 'miss' | 'expired' | 'stale'
  optimized: boolean
}

/**
 * CDN Integration Manager for Cloudflare
 */
export class CDNIntegrationManager {
  private readonly defaultOptions: Required<CDNOptions> = {
    cacheControl: 'public, max-age=31536000, immutable', // 1 year for images
    maxAge: 31536000, // 1 year in seconds
    staleWhileRevalidate: 86400, // 1 day
    imageOptimization: true,
    compressionLevel: 85
  }

  constructor(
    private env: CloudflareEnv,
    private options: Partial<CDNOptions> = {}
  ) {
    this.options = { ...this.defaultOptions, ...options }
  }

  /**
   * Generate optimized CDN URL for R2 object
   */
  generateCDNUrl(
    r2ObjectKey: string,
    transformOptions?: ImageTransformOptions
  ): string {
    const baseUrl = this.getR2PublicUrl(r2ObjectKey)
    
    if (!transformOptions || !this.options.imageOptimization) {
      return baseUrl
    }

    // Use Cloudflare Image Resizing if available
    if (this.env.CLOUDFLARE_IMAGES_ENABLED) {
      return this.buildCloudflareImagesUrl(r2ObjectKey, transformOptions)
    }

    // Fallback to query parameters for basic optimization
    return this.buildOptimizedUrl(baseUrl, transformOptions)
  }

  /**
   * Get cache headers for different content types
   */
  getCacheHeaders(contentType: string, customOptions?: Partial<CDNOptions>): Record<string, string> {
    const options = { ...this.options, ...customOptions }
    
    const headers: Record<string, string> = {
      'Cache-Control': options.cacheControl!,
      'CDN-Cache-Control': `max-age=${options.maxAge}`,
      'Cloudflare-CDN-Cache-Control': `max-age=${options.maxAge}`,
      'Vary': 'Accept, Accept-Encoding'
    }

    // Content-specific optimizations
    if (contentType.startsWith('image/')) {
      headers['Cache-Control'] = `public, max-age=${options.maxAge}, immutable`
      headers['X-Content-Type-Options'] = 'nosniff'
      
      // Enable Cloudflare Polish for image optimization
      if (options.imageOptimization) {
        headers['CF-Polish'] = 'lossy'
        headers['CF-Mirage'] = 'on'
      }
    } else if (contentType.includes('json')) {
      // Shorter cache for API responses
      headers['Cache-Control'] = `public, max-age=300, stale-while-revalidate=${options.staleWhileRevalidate}`
    }

    return headers
  }

  /**
   * Purge cache for specific URLs or patterns
   */
  async purgeCache(
    urls: string[] | string,
    options: {
      purgeEverything?: boolean
      tags?: string[]
      hosts?: string[]
    } = {}
  ): Promise<{
    success: boolean
    errors: string[]
    purgedUrls: string[]
  }> {
    const errors: string[] = []
    const purgedUrls: string[] = []

    try {
      const urlArray = Array.isArray(urls) ? urls : [urls]
      
      // Use Cloudflare API to purge cache
      const purgePayload: any = {}
      
      if (options.purgeEverything) {
        purgePayload.purge_everything = true
      } else {
        if (urlArray.length > 0) {
          purgePayload.files = urlArray
        }
        if (options.tags && options.tags.length > 0) {
          purgePayload.tags = options.tags
        }
        if (options.hosts && options.hosts.length > 0) {
          purgePayload.hosts = options.hosts
        }
      }

      // Make API call to Cloudflare
      const response = await this.makeCloudflareAPICall('/purge_cache', 'POST', purgePayload)
      
      if (response.success) {
        purgedUrls.push(...urlArray)
        console.log(`Successfully purged ${urlArray.length} URLs from CDN cache`)
      } else {
        errors.push(`Cache purge failed: ${response.errors?.join(', ') || 'Unknown error'}`)
      }

    } catch (error) {
      errors.push(`Cache purge error: ${error}`)
      console.error('CDN cache purge failed:', error)
    }

    return {
      success: errors.length === 0,
      errors,
      purgedUrls
    }
  }

  /**
   * Get cache analytics and performance metrics
   */
  async getCacheAnalytics(
    timeRange: '1h' | '6h' | '24h' | '7d' | '30d' = '24h'
  ): Promise<{
    hitRate: number
    bandwidth: number
    requests: number
    cacheStatus: Record<string, number>
    topUrls: Array<{ url: string; requests: number }>
  }> {
    try {
      // Use Cloudflare Analytics API
      const analytics = await this.makeCloudflareAPICall(
        `/zones/${this.env.CLOUDFLARE_ZONE_ID}/analytics/dashboard`,
        'GET',
        { since: this.getTimeRangeStart(timeRange) }
      )

      return {
        hitRate: analytics.result?.totals?.requests?.cached || 0,
        bandwidth: analytics.result?.totals?.bandwidth?.all || 0,
        requests: analytics.result?.totals?.requests?.all || 0,
        cacheStatus: analytics.result?.totals?.requests || {},
        topUrls: analytics.result?.top_urls || []
      }

    } catch (error) {
      console.error('Failed to get cache analytics:', error)
      return {
        hitRate: 0,
        bandwidth: 0,
        requests: 0,
        cacheStatus: {},
        topUrls: []
      }
    }
  }

  /**
   * Preload URLs into CDN cache
   */
  async preloadUrls(urls: string[]): Promise<{
    preloaded: number
    errors: string[]
  }> {
    const errors: string[] = []
    let preloaded = 0

    try {
      // Make HEAD requests to warm up the cache
      const preloadPromises = urls.map(async (url) => {
        try {
          const response = await fetch(url, {
            method: 'HEAD',
            headers: {
              'CF-Cache-Status': 'MISS', // Force cache miss to warm up
              'User-Agent': 'Ask-the-Captain-CDN-Preloader/1.0'
            }
          })

          if (response.ok) {
            preloaded++
            console.log(`Preloaded URL: ${url}`)
          } else {
            errors.push(`Failed to preload ${url}: HTTP ${response.status}`)
          }
        } catch (error) {
          errors.push(`Failed to preload ${url}: ${error}`)
        }
      })

      await Promise.all(preloadPromises)

    } catch (error) {
      errors.push(`Preload batch failed: ${error}`)
    }

    return { preloaded, errors }
  }

  /**
   * Build Cloudflare Images URL with transformations
   */
  private buildCloudflareImagesUrl(
    r2ObjectKey: string,
    options: ImageTransformOptions
  ): string {
    const baseUrl = `https://imagedelivery.net/${this.env.CLOUDFLARE_ACCOUNT_HASH}/${r2ObjectKey}`
    const params: string[] = []

    if (options.width) params.push(`w=${options.width}`)
    if (options.height) params.push(`h=${options.height}`)
    if (options.quality) params.push(`q=${options.quality}`)
    if (options.format) params.push(`f=${options.format}`)
    if (options.fit) params.push(`fit=${options.fit}`)

    return params.length > 0 ? `${baseUrl}/${params.join(',')}` : baseUrl
  }

  /**
   * Build optimized URL with query parameters
   */
  private buildOptimizedUrl(baseUrl: string, options: ImageTransformOptions): string {
    const url = new URL(baseUrl)
    
    if (options.width) url.searchParams.set('width', options.width.toString())
    if (options.height) url.searchParams.set('height', options.height.toString())
    if (options.quality) url.searchParams.set('quality', options.quality.toString())
    if (options.format) url.searchParams.set('format', options.format)
    if (options.fit) url.searchParams.set('fit', options.fit)

    return url.toString()
  }

  /**
   * Get R2 public URL
   */
  private getR2PublicUrl(objectKey: string): string {
    const bucketName = this.env.R2_BUCKET_NAME || 'ask-the-captain'
    const accountId = this.env.CLOUDFLARE_ACCOUNT_ID
    
    return `https://${bucketName}.${accountId}.r2.cloudflarestorage.com/${objectKey}`
  }

  /**
   * Make Cloudflare API call
   */
  private async makeCloudflareAPICall(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    data?: any
  ): Promise<any> {
    const apiToken = this.env.CLOUDFLARE_API_TOKEN
    const zoneId = this.env.CLOUDFLARE_ZONE_ID

    if (!apiToken || !zoneId) {
      throw new Error('Cloudflare API credentials not configured')
    }

    const url = `https://api.cloudflare.com/client/v4/zones/${zoneId}${endpoint}`
    
    const response = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json'
      },
      body: data ? JSON.stringify(data) : undefined
    })

    if (!response.ok) {
      throw new Error(`Cloudflare API error: ${response.status} ${response.statusText}`)
    }

    return response.json()
  }

  /**
   * Get time range start timestamp
   */
  private getTimeRangeStart(range: string): string {
    const now = new Date()
    const ranges = {
      '1h': 60 * 60 * 1000,
      '6h': 6 * 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000
    }

    const startTime = new Date(now.getTime() - ranges[range as keyof typeof ranges])
    return startTime.toISOString()
  }
}

/**
 * Utility functions for CDN integration
 */

/**
 * Generate cache-busting URL
 */
export function generateCacheBustingUrl(url: string, version?: string): string {
  const urlObj = new URL(url)
  urlObj.searchParams.set('v', version || Date.now().toString())
  return urlObj.toString()
}

/**
 * Extract cache status from response headers
 */
export function extractCacheStatus(headers: Headers): {
  status: 'hit' | 'miss' | 'expired' | 'stale' | 'unknown'
  age?: number
  ray?: string
} {
  const cfCacheStatus = headers.get('cf-cache-status')?.toLowerCase()
  const age = headers.get('age')
  const ray = headers.get('cf-ray')

  let status: 'hit' | 'miss' | 'expired' | 'stale' | 'unknown' = 'unknown'

  switch (cfCacheStatus) {
    case 'hit':
      status = 'hit'
      break
    case 'miss':
      status = 'miss'
      break
    case 'expired':
      status = 'expired'
      break
    case 'stale':
      status = 'stale'
      break
    default:
      status = 'unknown'
  }

  return {
    status,
    age: age ? parseInt(age, 10) : undefined,
    ray: ray || undefined
  }
}

/**
 * Create CDN-optimized response headers
 */
export function createCDNHeaders(
  contentType: string,
  options: Partial<CDNOptions> = {}
): Record<string, string> {
  const manager = new CDNIntegrationManager({} as CloudflareEnv, options)
  return manager.getCacheHeaders(contentType, options)
}

// Export types
export type { CDNOptions, ImageTransformOptions, CDNResponse }