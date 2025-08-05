'use client';

import React, { useState, useEffect, useRef } from 'react';
import { cn } from '@/app/lib/utils';
import { useImageCache, loadImageWithFallbacks, DEFAULT_CAPTAIN_IMAGES } from '@/app/lib/image-cache';
import CaptainImageLoader from './CaptainImageLoader';

interface CaptainImageProps {
  imageUrl: string;
  isGenerating?: boolean;
  onImageLoad?: () => void;
  onImageError?: (error: Error) => void;
  fallbackImage?: string;
  alt?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const CaptainImage: React.FC<CaptainImageProps> = ({
  imageUrl,
  isGenerating = false,
  onImageLoad,
  onImageError,
  fallbackImage = DEFAULT_CAPTAIN_IMAGES.default,
  alt = 'Capitão Caverna - Seu mentor no Modo Caverna',
  className,
  size = 'md'
}) => {
  const [currentImageUrl, setCurrentImageUrl] = useState<string>(imageUrl || fallbackImage);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [hasError, setHasError] = useState<boolean>(false);
  const [isTransitioning, setIsTransitioning] = useState<boolean>(false);
  const imageRef = useRef<HTMLImageElement>(null);
  const previousImageRef = useRef<HTMLImageElement>(null);
  
  // Use image cache hook
  const { preloadImage, getImageUrl, isCached } = useImageCache();

  // Size configurations
  const sizeClasses = {
    sm: 'w-24 h-24 md:w-28 md:h-28',
    md: 'w-32 h-32 md:w-40 md:h-40',
    lg: 'w-40 h-40 md:w-48 md:h-48',
    xl: 'w-48 h-48 md:w-56 md:h-56'
  };

  const framePadding = {
    sm: 'p-2',
    md: 'p-4',
    lg: 'p-5',
    xl: 'p-6'
  };

  // Handle image URL changes with smooth transitions
  useEffect(() => {
    if (imageUrl && imageUrl !== currentImageUrl) {
      handleImageTransition(imageUrl);
    }
  }, [imageUrl, currentImageUrl]);

  // Handle image transition with crossfade effect using cache
  const handleImageTransition = async (newImageUrl: string) => {
    if (isTransitioning) return;

    setIsTransitioning(true);
    setIsLoading(true);
    setHasError(false);

    try {
      // Use cached image loading with fallbacks
      const cachedUrl = await loadImageWithFallbacks(newImageUrl, [
        DEFAULT_CAPTAIN_IMAGES.default,
        DEFAULT_CAPTAIN_IMAGES.loading
      ]);
      
      // Start transition with cached URL
      setTimeout(() => {
        setCurrentImageUrl(cachedUrl);
        setIsLoading(false);
        setIsTransitioning(false);
        onImageLoad?.();
      }, 300); // Smooth transition delay
      
    } catch (error) {
      console.error('Failed to load Captain image:', error);
      setHasError(true);
      setIsLoading(false);
      setIsTransitioning(false);
      
      // Fallback to default image
      if (newImageUrl !== fallbackImage) {
        setCurrentImageUrl(fallbackImage);
      }
      
      onImageError?.(error as Error);
    }
  };

  // Handle image load success
  const handleImageLoad = () => {
    setIsLoading(false);
    setHasError(false);
    onImageLoad?.();
  };

  // Handle image load error with cache-aware fallback
  const handleImageError = async () => {
    console.error('Captain image failed to load:', currentImageUrl);
    setHasError(true);
    setIsLoading(false);
    
    // Try fallback image if not already using it
    if (currentImageUrl !== fallbackImage) {
      try {
        const fallbackUrl = await loadImageWithFallbacks(fallbackImage, [
          DEFAULT_CAPTAIN_IMAGES.error,
          DEFAULT_CAPTAIN_IMAGES.default
        ]);
        setCurrentImageUrl(fallbackUrl);
        setHasError(false);
      } catch (fallbackError) {
        console.error('Even fallback image failed to load:', fallbackError);
        onImageError?.(fallbackError as Error);
      }
    } else {
      onImageError?.(new Error(`Failed to load image: ${currentImageUrl}`));
    }
  };

  // Get container classes with glass morphism and cave theme
  const getContainerClasses = () => {
    return cn(
      // Base glass frame styling
      'captain-frame',
      'glass-border',
      'glass-medium',
      'rounded-2xl',
      framePadding[size],
      'card-elevated',
      'hover-cave-lift',
      'transition-all',
      'duration-500',
      'relative',
      'overflow-hidden',
      
      // Loading state
      isLoading && 'loading-cave',
      
      // Generating state
      isGenerating && 'animate-cave-glow',
      
      // Error state
      hasError && 'border-destructive/50',
      
      // Custom classes
      className
    );
  };

  // Get image container classes
  const getImageContainerClasses = () => {
    return cn(
      sizeClasses[size],
      'rounded-xl',
      'overflow-hidden',
      'bg-gradient-to-br',
      'from-primary/20',
      'to-accent/10',
      'border-2',
      'border-glass-border/30',
      'relative',
      'transition-all',
      'duration-500',
      
      // Hover effects
      'hover:border-glass-border/50',
      'hover:shadow-glow',
      
      // Loading state
      isLoading && 'animate-pulse',
      
      // Error state
      hasError && 'border-destructive/40 bg-destructive/10'
    );
  };

  // Get image classes
  const getImageClasses = () => {
    return cn(
      'w-full',
      'h-full',
      'object-cover',
      'transition-all',
      'duration-500',
      
      // Smooth transitions
      'hover:scale-105',
      
      // Loading/transition states
      (isLoading || isTransitioning) && 'opacity-70 scale-95',
      
      // Error state
      hasError && 'opacity-50 grayscale'
    );
  };

  return (
    <div 
      className={getContainerClasses()}
      role="img"
      aria-label={alt}
      aria-busy={isLoading || isGenerating}
    >
      {/* Glass frame lighting effect */}
      <div 
        className="absolute inset-0 rounded-2xl pointer-events-none"
        style={{
          background: 'radial-gradient(circle at 30% 30%, rgba(255, 51, 51, 0.15) 0%, transparent 60%)',
          mixBlendMode: 'overlay'
        }}
        aria-hidden="true"
      />
      
      {/* Image container */}
      <div className={getImageContainerClasses()}>
        {/* Main image */}
        <img
          ref={imageRef}
          src={getImageUrl(currentImageUrl)}
          alt={alt}
          className={getImageClasses()}
          onLoad={handleImageLoad}
          onError={handleImageError}
          loading="eager"
          decoding="async"
        />
        
        {/* Loading overlay with enhanced cave-themed loader */}
        {(isLoading || isGenerating || hasError) && (
          <div 
            className="absolute inset-0 flex items-center justify-center rounded-xl"
            aria-label={
              isGenerating ? 'Gerando nova imagem do Capitão' : 
              hasError ? 'Erro ao carregar imagem do Capitão' :
              'Carregando imagem do Capitão'
            }
          >
            <CaptainImageLoader
              isGenerating={isGenerating}
              isLoading={isLoading}
              hasError={hasError}
              size={size === 'sm' ? 'sm' : size === 'lg' ? 'lg' : size === 'xl' ? 'xl' : 'md'}
            />
          </div>
        )}
      </div>
      
      {/* Cave-themed glow effect for generating state */}
      {isGenerating && (
        <div 
          className="absolute inset-0 rounded-2xl pointer-events-none animate-cave-glow"
          style={{
            background: 'radial-gradient(circle, rgba(255, 51, 51, 0.2) 0%, transparent 70%)',
            filter: 'blur(1px)'
          }}
          aria-hidden="true"
        />
      )}
      
      {/* Accessibility: Screen reader status updates */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {isLoading && 'Carregando nova imagem do Capitão Caverna'}
        {isGenerating && 'Gerando nova imagem contextual do Capitão Caverna'}
        {hasError && 'Erro ao carregar imagem do Capitão Caverna'}
        {!isLoading && !isGenerating && !hasError && 'Imagem do Capitão Caverna carregada com sucesso'}
      </div>
    </div>
  );
};

export default CaptainImage;