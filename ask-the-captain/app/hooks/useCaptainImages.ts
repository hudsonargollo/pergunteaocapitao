'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useImageCache, DEFAULT_CAPTAIN_IMAGES, loadImageWithFallbacks } from '@/app/lib/image-cache';

interface CaptainImageState {
  currentImage: string;
  isLoading: boolean;
  isGenerating: boolean;
  hasError: boolean;
  preloadedImages: string[];
}

interface UseCaptainImagesOptions {
  initialImage?: string;
  preloadImages?: string[];
  enableAutoPreload?: boolean;
  maxPreloadQueue?: number;
}

interface UseCaptainImagesReturn {
  // State
  currentImage: string;
  isLoading: boolean;
  isGenerating: boolean;
  hasError: boolean;
  preloadedImages: string[];
  
  // Actions
  updateImage: (newImageUrl: string, isGenerating?: boolean) => Promise<void>;
  preloadImage: (imageUrl: string) => Promise<void>;
  preloadBatch: (imageUrls: string[]) => Promise<void>;
  resetToDefault: () => void;
  clearError: () => void;
  
  // Cache utilities
  getCacheStats: () => any;
  clearCache: () => void;
}

export function useCaptainImages(options: UseCaptainImagesOptions = {}): UseCaptainImagesReturn {
  const {
    initialImage = DEFAULT_CAPTAIN_IMAGES.default,
    preloadImages = [],
    enableAutoPreload = true,
    maxPreloadQueue = 10
  } = options;

  const [state, setState] = useState<CaptainImageState>({
    currentImage: initialImage,
    isLoading: false,
    isGenerating: false,
    hasError: false,
    preloadedImages: []
  });

  const { preloadImage: cachePreloadImage, preloadBatch: cachePreloadBatch, getImageUrl, getCacheStats, clearCache } = useImageCache();
  const preloadQueueRef = useRef<Set<string>>(new Set());
  const isUpdatingRef = useRef<boolean>(false);

  // Initialize with preload images
  useEffect(() => {
    if (enableAutoPreload && preloadImages.length > 0) {
      preloadBatch(preloadImages);
    }
  }, [preloadImages, enableAutoPreload]);

  // Update image with smooth transition and caching
  const updateImage = useCallback(async (newImageUrl: string, isGenerating = false) => {
    if (isUpdatingRef.current || newImageUrl === state.currentImage) {
      return;
    }

    isUpdatingRef.current = true;

    setState(prev => ({
      ...prev,
      isLoading: true,
      isGenerating,
      hasError: false
    }));

    try {
      // Load image with fallbacks using cache
      const cachedUrl = await loadImageWithFallbacks(newImageUrl, [
        DEFAULT_CAPTAIN_IMAGES.default,
        DEFAULT_CAPTAIN_IMAGES.loading
      ]);

      // Smooth transition delay
      await new Promise(resolve => setTimeout(resolve, 300));

      setState(prev => ({
        ...prev,
        currentImage: cachedUrl,
        isLoading: false,
        isGenerating: false,
        hasError: false,
        preloadedImages: [...new Set([...prev.preloadedImages, cachedUrl])]
      }));

    } catch (error) {
      console.error('Failed to update Captain image:', error);
      
      setState(prev => ({
        ...prev,
        isLoading: false,
        isGenerating: false,
        hasError: true
      }));

      // Try to fallback to default image
      if (newImageUrl !== DEFAULT_CAPTAIN_IMAGES.default) {
        try {
          const fallbackUrl = await loadImageWithFallbacks(DEFAULT_CAPTAIN_IMAGES.default);
          setState(prev => ({
            ...prev,
            currentImage: fallbackUrl,
            hasError: false
          }));
        } catch (fallbackError) {
          console.error('Even fallback image failed:', fallbackError);
        }
      }
    } finally {
      isUpdatingRef.current = false;
    }
  }, [state.currentImage]);

  // Preload single image
  const preloadImage = useCallback(async (imageUrl: string) => {
    if (preloadQueueRef.current.has(imageUrl) || preloadQueueRef.current.size >= maxPreloadQueue) {
      return;
    }

    preloadQueueRef.current.add(imageUrl);

    try {
      await cachePreloadImage(imageUrl, { priority: 'low', timeout: 8000 });
      
      setState(prev => ({
        ...prev,
        preloadedImages: [...new Set([...prev.preloadedImages, imageUrl])]
      }));
    } catch (error) {
      console.warn('Failed to preload Captain image:', imageUrl, error);
    } finally {
      preloadQueueRef.current.delete(imageUrl);
    }
  }, [cachePreloadImage, maxPreloadQueue]);

  // Preload batch of images
  const preloadBatch = useCallback(async (imageUrls: string[]) => {
    const filteredUrls = imageUrls.filter(url => 
      !preloadQueueRef.current.has(url) && 
      !state.preloadedImages.includes(url)
    ).slice(0, maxPreloadQueue - preloadQueueRef.current.size);

    if (filteredUrls.length === 0) {
      return;
    }

    // Add to queue
    filteredUrls.forEach(url => preloadQueueRef.current.add(url));

    try {
      const results = await cachePreloadBatch(filteredUrls, { 
        priority: 'low', 
        timeout: 10000 
      });

      setState(prev => ({
        ...prev,
        preloadedImages: [...new Set([...prev.preloadedImages, ...results])]
      }));
    } catch (error) {
      console.warn('Failed to preload Captain image batch:', error);
    } finally {
      // Remove from queue
      filteredUrls.forEach(url => preloadQueueRef.current.delete(url));
    }
  }, [cachePreloadBatch, maxPreloadQueue, state.preloadedImages]);

  // Reset to default image
  const resetToDefault = useCallback(() => {
    setState(prev => ({
      ...prev,
      currentImage: DEFAULT_CAPTAIN_IMAGES.default,
      isLoading: false,
      isGenerating: false,
      hasError: false
    }));
  }, []);

  // Clear error state
  const clearError = useCallback(() => {
    setState(prev => ({
      ...prev,
      hasError: false
    }));
  }, []);

  // Auto-preload related images based on current image
  useEffect(() => {
    if (!enableAutoPreload || state.isLoading) {
      return;
    }

    // Preload default images if not already preloaded
    const defaultImages = Object.values(DEFAULT_CAPTAIN_IMAGES);
    const unpreloadedDefaults = defaultImages.filter(img => 
      !state.preloadedImages.includes(img) && 
      img !== state.currentImage
    );

    if (unpreloadedDefaults.length > 0) {
      preloadBatch(unpreloadedDefaults);
    }
  }, [state.currentImage, state.isLoading, state.preloadedImages, enableAutoPreload, preloadBatch]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      preloadQueueRef.current.clear();
      isUpdatingRef.current = false;
    };
  }, []);

  return {
    // State
    currentImage: getImageUrl(state.currentImage),
    isLoading: state.isLoading,
    isGenerating: state.isGenerating,
    hasError: state.hasError,
    preloadedImages: state.preloadedImages,
    
    // Actions
    updateImage,
    preloadImage,
    preloadBatch,
    resetToDefault,
    clearError,
    
    // Cache utilities
    getCacheStats,
    clearCache
  };
}

// Hook for managing multiple Captain image contexts (e.g., different conversation threads)
export function useCaptainImageContext(contextId: string, options: UseCaptainImagesOptions = {}) {
  const contextKey = `captain-images-${contextId}`;
  
  // Store context-specific state in sessionStorage for persistence
  const getStoredState = useCallback((): Partial<CaptainImageState> => {
    if (typeof window === 'undefined') return {};
    
    try {
      const stored = sessionStorage.getItem(contextKey);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  }, [contextKey]);

  const storeState = useCallback((state: Partial<CaptainImageState>) => {
    if (typeof window === 'undefined') return;
    
    try {
      sessionStorage.setItem(contextKey, JSON.stringify(state));
    } catch (error) {
      console.warn('Failed to store Captain image context:', error);
    }
  }, [contextKey]);

  const storedState = getStoredState();
  const captainImages = useCaptainImages({
    ...options,
    initialImage: storedState.currentImage || options.initialImage
  });

  // Store state changes
  useEffect(() => {
    storeState({
      currentImage: captainImages.currentImage,
      preloadedImages: captainImages.preloadedImages
    });
  }, [captainImages.currentImage, captainImages.preloadedImages, storeState]);

  return captainImages;
}

export type { CaptainImageState, UseCaptainImagesOptions, UseCaptainImagesReturn };