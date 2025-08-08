/**
 * Hook for managing Captain image consistency across the application
 * Provides centralized image validation, caching, and fallback management
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useCaptainImageValidator, type ResponseContext, type ValidationResult } from '@/app/lib/captain-image-validator';
import { loadValidatedCaptainImage } from '@/app/lib/image-cache';

interface ImageConsistencyState {
  currentImageUrl: string;
  isValidating: boolean;
  validationResult: ValidationResult | null;
  usedFallback: boolean;
  retryCount: number;
  lastValidationTime: number;
}

interface ImageConsistencyOptions {
  enableValidation?: boolean;
  maxRetries?: number;
  validationCacheTime?: number;
  autoRetryOnFailure?: boolean;
}

interface ImageLoadResult {
  success: boolean;
  imageUrl: string;
  validationResult?: ValidationResult;
  usedFallback: boolean;
  error?: Error;
}

export function useCaptainImageConsistency(
  initialImageUrl?: string,
  options: ImageConsistencyOptions = {}
) {
  const {
    enableValidation = true,
    maxRetries = 3,
    validationCacheTime = 30 * 60 * 1000, // 30 minutes
    autoRetryOnFailure = true
  } = options;

  // State management
  const [state, setState] = useState<ImageConsistencyState>({
    currentImageUrl: initialImageUrl || '',
    isValidating: false,
    validationResult: null,
    usedFallback: false,
    retryCount: 0,
    lastValidationTime: 0
  });

  // Hooks and refs
  const { validateImage, selectFallbackImage, getValidationStats } = useCaptainImageValidator();
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const validationCacheRef = useRef<Map<string, { result: ValidationResult; timestamp: number }>>(new Map());

  // Clear retry timeout on unmount
  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

  /**
   * Load and validate a Captain image with consistency checks
   */
  const loadCaptainImage = useCallback(async (
    imageUrl: string,
    context?: ResponseContext
  ): Promise<ImageLoadResult> => {
    setState(prev => ({
      ...prev,
      isValidating: true,
      retryCount: 0
    }));

    try {
      // Check validation cache first
      const cacheKey = `${imageUrl}-${context?.tone || 'default'}`;
      const cached = validationCacheRef.current.get(cacheKey);
      const now = Date.now();

      if (cached && (now - cached.timestamp) < validationCacheTime) {
        setState(prev => ({
          ...prev,
          currentImageUrl: imageUrl,
          isValidating: false,
          validationResult: cached.result,
          usedFallback: false,
          lastValidationTime: now
        }));

        return {
          success: true,
          imageUrl,
          validationResult: cached.result,
          usedFallback: false
        };
      }

      // Load with validation
      const result = await loadValidatedCaptainImage(imageUrl, context);
      
      // Get detailed validation if enabled
      let validationResult: ValidationResult | undefined;
      if (enableValidation && result.isValidated) {
        validationResult = await validateImage(result.imageUrl, context);
        
        // Cache the validation result
        validationCacheRef.current.set(cacheKey, {
          result: validationResult,
          timestamp: now
        });
      }

      setState(prev => ({
        ...prev,
        currentImageUrl: result.imageUrl,
        isValidating: false,
        validationResult: validationResult || null,
        usedFallback: result.usedFallback,
        retryCount: 0,
        lastValidationTime: now
      }));

      return {
        success: true,
        imageUrl: result.imageUrl,
        validationResult,
        usedFallback: result.usedFallback
      };

    } catch (error) {
      console.error('Failed to load Captain image:', error);

      // Handle retry logic
      if (autoRetryOnFailure && state.retryCount < maxRetries) {
        const newRetryCount = state.retryCount + 1;
        setState(prev => ({
          ...prev,
          retryCount: newRetryCount,
          isValidating: false
        }));

        // Exponential backoff retry
        const retryDelay = Math.min(1000 * Math.pow(2, newRetryCount - 1), 10000);
        retryTimeoutRef.current = setTimeout(() => {
          loadCaptainImage(imageUrl, context);
        }, retryDelay);

        return {
          success: false,
          imageUrl: state.currentImageUrl,
          usedFallback: state.usedFallback,
          error: error as Error
        };
      }

      // Use fallback image
      const fallbackUrl = selectFallbackImage(context);
      setState(prev => ({
        ...prev,
        currentImageUrl: fallbackUrl,
        isValidating: false,
        usedFallback: true,
        retryCount: 0
      }));

      return {
        success: false,
        imageUrl: fallbackUrl,
        usedFallback: true,
        error: error as Error
      };
    }
  }, [enableValidation, validateImage, selectFallbackImage, maxRetries, autoRetryOnFailure, validationCacheTime, state.retryCount, state.currentImageUrl, state.usedFallback]);

  /**
   * Validate current image without reloading
   */
  const validateCurrentImage = useCallback(async (context?: ResponseContext): Promise<ValidationResult | null> => {
    if (!state.currentImageUrl || !enableValidation) {
      return null;
    }

    setState(prev => ({ ...prev, isValidating: true }));

    try {
      const result = await validateImage(state.currentImageUrl, context);
      
      setState(prev => ({
        ...prev,
        validationResult: result,
        isValidating: false,
        lastValidationTime: Date.now()
      }));

      return result;
    } catch (error) {
      console.error('Failed to validate current image:', error);
      setState(prev => ({ ...prev, isValidating: false }));
      return null;
    }
  }, [state.currentImageUrl, enableValidation, validateImage]);

  /**
   * Force refresh current image with validation
   */
  const refreshImage = useCallback(async (context?: ResponseContext): Promise<ImageLoadResult> => {
    // Clear cache for current image
    const cacheKey = `${state.currentImageUrl}-${context?.tone || 'default'}`;
    validationCacheRef.current.delete(cacheKey);

    // Reload image
    return loadCaptainImage(state.currentImageUrl, context);
  }, [state.currentImageUrl, loadCaptainImage]);

  /**
   * Get fallback image for current context
   */
  const getFallbackImage = useCallback((context?: ResponseContext): string => {
    return selectFallbackImage(context);
  }, [selectFallbackImage]);

  /**
   * Clear validation cache
   */
  const clearValidationCache = useCallback(() => {
    validationCacheRef.current.clear();
  }, []);

  /**
   * Get consistency statistics
   */
  const getConsistencyStats = useCallback(() => {
    const validationStats = getValidationStats();
    const cacheStats = {
      cacheSize: validationCacheRef.current.size,
      lastValidationTime: state.lastValidationTime,
      currentScore: state.validationResult?.score || 0
    };

    return {
      ...validationStats,
      ...cacheStats,
      isUsingFallback: state.usedFallback,
      retryCount: state.retryCount
    };
  }, [getValidationStats, state.lastValidationTime, state.validationResult, state.usedFallback, state.retryCount]);

  /**
   * Check if image needs revalidation
   */
  const needsRevalidation = useCallback((maxAge: number = validationCacheTime): boolean => {
    if (!state.lastValidationTime) return true;
    return (Date.now() - state.lastValidationTime) > maxAge;
  }, [state.lastValidationTime, validationCacheTime]);

  return {
    // State
    currentImageUrl: state.currentImageUrl,
    isValidating: state.isValidating,
    validationResult: state.validationResult,
    usedFallback: state.usedFallback,
    retryCount: state.retryCount,
    
    // Actions
    loadCaptainImage,
    validateCurrentImage,
    refreshImage,
    getFallbackImage,
    clearValidationCache,
    
    // Utilities
    getConsistencyStats,
    needsRevalidation,
    
    // Configuration
    isValidationEnabled: enableValidation,
    maxRetries
  };
}

export type { ImageConsistencyState, ImageConsistencyOptions, ImageLoadResult };