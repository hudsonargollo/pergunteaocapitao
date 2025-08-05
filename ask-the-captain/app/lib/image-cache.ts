/**
 * Image Caching and Preloading System for Captain Images
 * Provides client-side caching, preloading, and error recovery
 */

interface CachedImage {
  url: string;
  blob: Blob;
  timestamp: number;
  objectUrl: string;
}

interface PreloadOptions {
  priority?: 'high' | 'low';
  timeout?: number;
  retries?: number;
}

interface CacheOptions {
  maxSize?: number; // Maximum number of images to cache
  maxAge?: number;  // Maximum age in milliseconds
  compressionQuality?: number;
}

class ImageCacheManager {
  private cache = new Map<string, CachedImage>();
  private preloadQueue = new Set<string>();
  private loadingPromises = new Map<string, Promise<string>>();
  private options: Required<CacheOptions>;

  constructor(options: CacheOptions = {}) {
    this.options = {
      maxSize: options.maxSize ?? 50,
      maxAge: options.maxAge ?? 30 * 60 * 1000, // 30 minutes
      compressionQuality: options.compressionQuality ?? 0.8
    };

    // Clean up cache periodically
    this.startCacheCleanup();
  }

  /**
   * Preload an image with caching
   */
  async preloadImage(url: string, options: PreloadOptions = {}): Promise<string> {
    const {
      priority = 'high',
      timeout = 10000,
      retries = 2
    } = options;

    // Return cached version if available
    const cached = this.getCachedImage(url);
    if (cached) {
      return cached.objectUrl;
    }

    // Return existing loading promise if already loading
    if (this.loadingPromises.has(url)) {
      return this.loadingPromises.get(url)!;
    }

    // Create loading promise
    const loadingPromise = this.loadAndCacheImage(url, { timeout, retries, priority });
    this.loadingPromises.set(url, loadingPromise);

    try {
      const result = await loadingPromise;
      return result;
    } finally {
      this.loadingPromises.delete(url);
    }
  }

  /**
   * Load and cache an image
   */
  private async loadAndCacheImage(
    url: string, 
    options: { timeout: number; retries: number; priority: string }
  ): Promise<string> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= options.retries; attempt++) {
      try {
        const objectUrl = await this.fetchAndCacheImage(url, options.timeout, options.priority);
        return objectUrl;
      } catch (error) {
        lastError = error as Error;
        console.warn(`Image preload attempt ${attempt + 1} failed for ${url}:`, error);
        
        // Wait before retry (exponential backoff)
        if (attempt < options.retries) {
          await this.delay(Math.pow(2, attempt) * 1000);
        }
      }
    }

    throw lastError || new Error(`Failed to load image after ${options.retries + 1} attempts`);
  }

  /**
   * Fetch and cache image with timeout
   */
  private async fetchAndCacheImage(url: string, timeout: number, priority: string): Promise<string> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      // Create fetch request with appropriate priority
      const fetchOptions: RequestInit = {
        signal: controller.signal,
        cache: 'force-cache'
      };

      const response = await fetch(url, fetchOptions);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const blob = await response.blob();
      
      // Validate image type
      if (!blob.type.startsWith('image/')) {
        throw new Error(`Invalid image type: ${blob.type}`);
      }

      // Create object URL
      const objectUrl = URL.createObjectURL(blob);

      // Cache the image
      this.cacheImage(url, blob, objectUrl);

      return objectUrl;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Cache an image
   */
  private cacheImage(url: string, blob: Blob, objectUrl: string): void {
    // Remove oldest entries if cache is full
    if (this.cache.size >= this.options.maxSize) {
      this.evictOldestEntries(Math.floor(this.options.maxSize * 0.2));
    }

    const cachedImage: CachedImage = {
      url,
      blob,
      timestamp: Date.now(),
      objectUrl
    };

    this.cache.set(url, cachedImage);
  }

  /**
   * Get cached image if available and not expired
   */
  private getCachedImage(url: string): CachedImage | null {
    const cached = this.cache.get(url);
    
    if (!cached) {
      return null;
    }

    // Check if expired
    if (Date.now() - cached.timestamp > this.options.maxAge) {
      this.removeCachedImage(url);
      return null;
    }

    return cached;
  }

  /**
   * Remove cached image and clean up object URL
   */
  private removeCachedImage(url: string): void {
    const cached = this.cache.get(url);
    if (cached) {
      URL.revokeObjectURL(cached.objectUrl);
      this.cache.delete(url);
    }
  }

  /**
   * Evict oldest cache entries
   */
  private evictOldestEntries(count: number): void {
    const entries = Array.from(this.cache.entries())
      .sort(([, a], [, b]) => a.timestamp - b.timestamp)
      .slice(0, count);

    entries.forEach(([url]) => {
      this.removeCachedImage(url);
    });
  }

  /**
   * Start periodic cache cleanup
   */
  private startCacheCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      const expiredUrls: string[] = [];

      this.cache.forEach((cached, url) => {
        if (now - cached.timestamp > this.options.maxAge) {
          expiredUrls.push(url);
        }
      });

      expiredUrls.forEach(url => this.removeCachedImage(url));
    }, 5 * 60 * 1000); // Clean up every 5 minutes
  }

  /**
   * Preload multiple images in batch
   */
  async preloadBatch(urls: string[], options: PreloadOptions = {}): Promise<string[]> {
    const promises = urls.map(url => 
      this.preloadImage(url, { ...options, priority: 'low' })
        .catch(error => {
          console.warn(`Failed to preload image ${url}:`, error);
          return null;
        })
    );

    const results = await Promise.all(promises);
    return results.filter((url): url is string => url !== null);
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    size: number;
    maxSize: number;
    oldestTimestamp: number;
    newestTimestamp: number;
  } {
    const timestamps = Array.from(this.cache.values()).map(c => c.timestamp);
    
    return {
      size: this.cache.size,
      maxSize: this.options.maxSize,
      oldestTimestamp: timestamps.length > 0 ? Math.min(...timestamps) : 0,
      newestTimestamp: timestamps.length > 0 ? Math.max(...timestamps) : 0
    };
  }

  /**
   * Clear all cached images
   */
  clearCache(): void {
    this.cache.forEach((cached) => {
      URL.revokeObjectURL(cached.objectUrl);
    });
    this.cache.clear();
  }

  /**
   * Check if image is cached
   */
  isCached(url: string): boolean {
    return this.getCachedImage(url) !== null;
  }

  /**
   * Get cached image URL or original URL
   */
  getImageUrl(url: string): string {
    const cached = this.getCachedImage(url);
    return cached ? cached.objectUrl : url;
  }

  /**
   * Utility: delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Cleanup on page unload
   */
  cleanup(): void {
    this.clearCache();
    this.loadingPromises.clear();
    this.preloadQueue.clear();
  }
}

// Default image URLs for fallbacks
export const DEFAULT_CAPTAIN_IMAGES = {
  default: '/placeholder-captain.svg',
  loading: '/placeholder-captain.svg',
  error: '/placeholder-captain.svg',
  welcome: '/placeholder-captain.svg'
} as const;

// Create singleton instance
export const imageCacheManager = new ImageCacheManager({
  maxSize: 50,
  maxAge: 30 * 60 * 1000, // 30 minutes
  compressionQuality: 0.8
});

// Cleanup on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    imageCacheManager.cleanup();
  });
}

/**
 * Hook for using image cache in React components
 */
export function useImageCache() {
  return {
    preloadImage: (url: string, options?: PreloadOptions) => 
      imageCacheManager.preloadImage(url, options),
    preloadBatch: (urls: string[], options?: PreloadOptions) => 
      imageCacheManager.preloadBatch(urls, options),
    getImageUrl: (url: string) => imageCacheManager.getImageUrl(url),
    isCached: (url: string) => imageCacheManager.isCached(url),
    getCacheStats: () => imageCacheManager.getCacheStats(),
    clearCache: () => imageCacheManager.clearCache()
  };
}

/**
 * Utility function to create optimized image loading with fallbacks
 */
export async function loadImageWithFallbacks(
  primaryUrl: string,
  fallbackUrls: string[] = [DEFAULT_CAPTAIN_IMAGES.default]
): Promise<string> {
  const allUrls = [primaryUrl, ...fallbackUrls];
  
  for (const url of allUrls) {
    try {
      return await imageCacheManager.preloadImage(url, { 
        timeout: 5000, 
        retries: 1 
      });
    } catch (error) {
      console.warn(`Failed to load image ${url}:`, error);
      continue;
    }
  }
  
  throw new Error('All image URLs failed to load');
}

export type { PreloadOptions, CacheOptions, CachedImage };