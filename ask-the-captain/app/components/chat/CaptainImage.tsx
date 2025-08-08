'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/app/lib/utils';
import { useImageCache, loadImageWithFallbacks, loadValidatedCaptainImage, DEFAULT_CAPTAIN_IMAGES } from '@/app/lib/image-cache';
import { useCaptainImageValidator, type ResponseContext, type ValidationResult } from '@/app/lib/captain-image-validator';
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
  enableAnimations?: boolean;
  showGlowEffect?: boolean;
  contextualVariation?: 'supportive' | 'challenging' | 'instructional' | 'motivational' | 'default';
  enableValidation?: boolean;
  responseContext?: ResponseContext;
  onValidationComplete?: (result: ValidationResult) => void;
}

const CaptainImage: React.FC<CaptainImageProps> = ({
  imageUrl,
  isGenerating = false,
  onImageLoad,
  onImageError,
  fallbackImage = DEFAULT_CAPTAIN_IMAGES.default,
  alt = 'Capitão Caverna - Seu mentor no Modo Caverna',
  className,
  size = 'md',
  enableAnimations = true,
  showGlowEffect = true,
  contextualVariation = 'default',
  enableValidation = true,
  responseContext,
  onValidationComplete
}) => {
  const [currentImageUrl, setCurrentImageUrl] = useState<string>(imageUrl || fallbackImage);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [hasError, setHasError] = useState<boolean>(false);
  const [isTransitioning, setIsTransitioning] = useState<boolean>(false);
  const [imageLoadProgress, setImageLoadProgress] = useState<number>(0);
  const [retryCount, setRetryCount] = useState<number>(0);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [usedFallback, setUsedFallback] = useState<boolean>(false);
  const imageRef = useRef<HTMLImageElement>(null);
  const previousImageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Use image cache and validation hooks
  const { preloadImage, getImageUrl, isCached } = useImageCache();
  const { validateImage, selectFallbackImage } = useCaptainImageValidator();

  // Enhanced contextual fallback images based on variation
  const contextualFallbacks = {
    supportive: '/images/captain-supportive-fallback.png',
    challenging: '/images/captain-challenging-fallback.png',
    instructional: '/images/captain-instructional-fallback.png',
    motivational: '/images/captain-motivational-fallback.png',
    default: DEFAULT_CAPTAIN_IMAGES.default
  };

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

  // Enhanced image transition with smooth crossfade effect and progress tracking
  const handleImageTransition = async (newImageUrl: string) => {
    if (isTransitioning) return;

    setIsTransitioning(true);
    setIsLoading(true);
    setHasError(false);
    setImageLoadProgress(0);
    setRetryCount(0);

    try {
      // Simulate loading progress for better UX
      const progressInterval = setInterval(() => {
        setImageLoadProgress(prev => Math.min(prev + 10, 90));
      }, 100);

      // Use enhanced image loading with validation if enabled
      let cachedUrl: string;
      let validationData: ValidationResult | null = null;
      let fallbackUsed = false;

      if (enableValidation) {
        const result = await loadValidatedCaptainImage(
          newImageUrl,
          responseContext || { tone: contextualVariation as any, themes: [], intensity: 'medium' },
          [
            contextualFallbacks[contextualVariation] || fallbackImage,
            DEFAULT_CAPTAIN_IMAGES.default,
            DEFAULT_CAPTAIN_IMAGES.loading
          ]
        );

        cachedUrl = result.imageUrl;
        fallbackUsed = result.usedFallback;

        // Get detailed validation result
        if (result.isValidated) {
          try {
            validationData = await validateImage(cachedUrl, responseContext);
            setValidationResult(validationData);
            onValidationComplete?.(validationData);
          } catch (validationError) {
            console.warn('Failed to get validation details:', validationError);
          }
        }
      } else {
        // Use standard loading without validation
        const contextualFallback = contextualFallbacks[contextualVariation] || fallbackImage;
        cachedUrl = await loadImageWithFallbacks(newImageUrl, [
          contextualFallback,
          DEFAULT_CAPTAIN_IMAGES.default,
          DEFAULT_CAPTAIN_IMAGES.loading
        ]);
      }

      setUsedFallback(fallbackUsed);

      clearInterval(progressInterval);
      setImageLoadProgress(100);

      // Enhanced transition with animation support
      if (enableAnimations) {
        // Smooth transition delay for animation
        setTimeout(() => {
          setCurrentImageUrl(cachedUrl);
          setIsLoading(false);
          setIsTransitioning(false);
          onImageLoad?.();
        }, 400);
      } else {
        setCurrentImageUrl(cachedUrl);
        setIsLoading(false);
        setIsTransitioning(false);
        onImageLoad?.();
      }

    } catch (error) {
      console.error('Failed to load Captain image:', error);
      setHasError(true);
      setIsLoading(false);
      setIsTransitioning(false);
      setImageLoadProgress(0);

      // Enhanced fallback strategy with retry logic
      if (retryCount < 2) {
        setRetryCount(prev => prev + 1);
        setTimeout(() => {
          handleImageTransition(newImageUrl);
        }, 1000 * (retryCount + 1)); // Exponential backoff
      } else {
        // Use validation-aware contextual fallback
        let contextualFallback: string;

        if (enableValidation && responseContext) {
          contextualFallback = selectFallbackImage(responseContext);
        } else {
          contextualFallback = contextualFallbacks[contextualVariation] || fallbackImage;
        }

        if (newImageUrl !== contextualFallback) {
          setCurrentImageUrl(contextualFallback);
          setUsedFallback(true);
        }
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

  // Enhanced image error handling with contextual fallbacks
  const handleImageError = async () => {
    console.error('Captain image failed to load:', currentImageUrl);
    setHasError(true);
    setIsLoading(false);

    // Try contextual fallback first, then general fallbacks
    const contextualFallback = contextualFallbacks[contextualVariation] || fallbackImage;

    if (currentImageUrl !== contextualFallback) {
      try {
        const fallbackUrl = await loadImageWithFallbacks(contextualFallback, [
          DEFAULT_CAPTAIN_IMAGES.error,
          DEFAULT_CAPTAIN_IMAGES.default
        ]);
        setCurrentImageUrl(fallbackUrl);
        setHasError(false);
      } catch (fallbackError) {
        console.error('Even contextual fallback image failed to load:', fallbackError);

        // Last resort: try the basic default
        if (contextualFallback !== DEFAULT_CAPTAIN_IMAGES.default) {
          setCurrentImageUrl(DEFAULT_CAPTAIN_IMAGES.default);
        }

        onImageError?.(fallbackError as Error);
      }
    } else {
      onImageError?.(new Error(`Failed to load image: ${currentImageUrl}`));
    }
  };

  // Enhanced container classes with contextual variations and animation support
  const getContainerClasses = () => {
    return cn(
      // Base glass frame styling with enhanced cave theme
      'captain-frame',
      'cave-glass',
      'rounded-2xl',
      framePadding[size],
      'relative',
      'overflow-hidden',
      'transition-all',
      'duration-500',

      // Enhanced interactive states
      enableAnimations && [
        'card-elevated',
        'hover-cave-lift',
        'transform-gpu' // Hardware acceleration
      ],

      // Contextual variations
      contextualVariation === 'supportive' && 'border-cave-ember/30',
      contextualVariation === 'challenging' && 'border-cave-red/40',
      contextualVariation === 'instructional' && 'border-cave-torch/30',
      contextualVariation === 'motivational' && 'border-cave-red/50',

      // Loading state with enhanced cave shimmer
      isLoading && 'animate-cave-shimmer',

      // Generating state with enhanced glow
      isGenerating && showGlowEffect && 'animate-cave-glow',

      // Error state with contextual styling
      hasError && [
        'border-destructive/50',
        'bg-destructive/5'
      ],

      // Transition state
      isTransitioning && 'scale-[1.02]',

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

  // Animation variants for framer-motion
  const containerVariants = {
    initial: { opacity: 0, scale: 0.9, rotateY: -15 },
    animate: { opacity: 1, scale: 1, rotateY: 0 },
    exit: { opacity: 0, scale: 0.95, rotateY: 15 }
  };

  const imageVariants = {
    initial: { opacity: 0, scale: 0.8 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 1.1 }
  };

  const glowVariants = {
    animate: {
      opacity: [0.3, 0.8, 0.3],
      scale: [1, 1.05, 1]
    }
  };

  return (
    <motion.div
      ref={containerRef}
      className={getContainerClasses()}
      role="img"
      aria-label={alt}
      aria-busy={isLoading || isGenerating}
      variants={enableAnimations ? containerVariants : undefined}
      initial={enableAnimations ? "initial" : undefined}
      animate={enableAnimations ? "animate" : undefined}
      exit={enableAnimations ? "exit" : undefined}
      transition={{ duration: 0.6, ease: "easeOut" }}
      whileHover={enableAnimations ? {
        scale: 1.02,
        rotateY: 2,
        transition: { duration: 0.3 }
      } : undefined}
    >
      {/* Enhanced glass frame lighting effect with contextual colors */}
      <motion.div
        className="absolute inset-0 rounded-2xl pointer-events-none"
        style={{
          background: contextualVariation === 'supportive'
            ? 'radial-gradient(circle at 30% 30%, rgba(255, 165, 0, 0.15) 0%, transparent 60%)'
            : contextualVariation === 'challenging'
              ? 'radial-gradient(circle at 30% 30%, rgba(255, 51, 51, 0.2) 0%, transparent 60%)'
              : contextualVariation === 'instructional'
                ? 'radial-gradient(circle at 30% 30%, rgba(255, 215, 0, 0.15) 0%, transparent 60%)'
                : contextualVariation === 'motivational'
                  ? 'radial-gradient(circle at 30% 30%, rgba(255, 51, 51, 0.25) 0%, transparent 60%)'
                  : 'radial-gradient(circle at 30% 30%, rgba(255, 51, 51, 0.15) 0%, transparent 60%)',
          mixBlendMode: 'overlay'
        }}
        animate={enableAnimations && showGlowEffect ? {
          opacity: [0.6, 1, 0.6],
          transition: { duration: 4, repeat: Infinity, ease: "easeInOut" }
        } : undefined}
        aria-hidden="true"
      />

      {/* Image container with enhanced styling */}
      <div className={getImageContainerClasses()}>
        <AnimatePresence mode="wait">
          <motion.img
            key={currentImageUrl}
            ref={imageRef}
            src={getImageUrl(currentImageUrl)}
            alt={alt}
            className={getImageClasses()}
            onLoad={handleImageLoad}
            onError={handleImageError}
            loading="eager"
            decoding="async"
            variants={enableAnimations ? imageVariants : undefined}
            initial={enableAnimations ? "initial" : undefined}
            animate={enableAnimations ? "animate" : undefined}
            exit={enableAnimations ? "exit" : undefined}
          />
        </AnimatePresence>

        {/* Enhanced loading overlay with progress indicator */}
        <AnimatePresence>
          {(isLoading || isGenerating || hasError) && (
            <motion.div
              className="absolute inset-0 flex flex-col items-center justify-center rounded-xl cave-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
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

              {/* Progress bar for loading */}
              {isLoading && imageLoadProgress > 0 && (
                <motion.div
                  className="mt-3 w-16 h-1 bg-cave-stone/30 rounded-full overflow-hidden"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <motion.div
                    className="h-full bg-gradient-to-r from-cave-red to-cave-ember rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${imageLoadProgress}%` }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                  />
                </motion.div>
              )}

              {/* Retry indicator */}
              {retryCount > 0 && (
                <motion.div
                  className="mt-2 text-xs text-cave-mist/70"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  Tentativa {retryCount + 1}/3
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Enhanced cave-themed glow effect for generating state */}
      <AnimatePresence>
        {isGenerating && showGlowEffect && (
          <motion.div
            className="absolute inset-0 rounded-2xl pointer-events-none"
            style={{
              background: contextualVariation === 'supportive'
                ? 'radial-gradient(circle, rgba(255, 165, 0, 0.3) 0%, transparent 70%)'
                : contextualVariation === 'challenging'
                  ? 'radial-gradient(circle, rgba(255, 51, 51, 0.3) 0%, transparent 70%)'
                  : contextualVariation === 'instructional'
                    ? 'radial-gradient(circle, rgba(255, 215, 0, 0.3) 0%, transparent 70%)'
                    : contextualVariation === 'motivational'
                      ? 'radial-gradient(circle, rgba(255, 51, 51, 0.4) 0%, transparent 70%)'
                      : 'radial-gradient(circle, rgba(255, 51, 51, 0.2) 0%, transparent 70%)',
              filter: 'blur(2px)'
            }}
            variants={glowVariants}
            animate="animate"
            initial={{ opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            aria-hidden="true"
          />
        )}
      </AnimatePresence>

      {/* Contextual border accent */}
      <motion.div
        className="absolute inset-0 rounded-2xl pointer-events-none border-2"
        style={{
          borderColor: contextualVariation === 'supportive'
            ? 'rgba(255, 165, 0, 0.3)'
            : contextualVariation === 'challenging'
              ? 'rgba(255, 51, 51, 0.4)'
              : contextualVariation === 'instructional'
                ? 'rgba(255, 215, 0, 0.3)'
                : contextualVariation === 'motivational'
                  ? 'rgba(255, 51, 51, 0.5)'
                  : 'rgba(255, 51, 51, 0.2)'
        }}
        animate={enableAnimations ? {
          opacity: [0.3, 0.7, 0.3],
          transition: { duration: 2, repeat: Infinity, ease: "easeInOut" }
        } : undefined}
        aria-hidden="true"
      />

      {/* Validation status indicator */}
      {enableValidation && validationResult && !isLoading && !isGenerating && (
        <motion.div
          className="absolute top-2 right-2 z-10"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5, duration: 0.3 }}
        >
          <div
            className={cn(
              'w-3 h-3 rounded-full border-2 border-cave-dark/50',
              validationResult.score >= 90 ? 'bg-green-500' :
                validationResult.score >= 70 ? 'bg-yellow-500' :
                  'bg-red-500'
            )}
            title={`Validation Score: ${validationResult.score}/100${usedFallback ? ' (Fallback Used)' : ''}`}
            aria-label={`Image validation score: ${validationResult.score} out of 100`}
          />
        </motion.div>
      )}

      {/* Fallback indicator */}
      {usedFallback && !isLoading && !isGenerating && (
        <motion.div
          className="absolute bottom-2 left-2 z-10"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.3 }}
        >
          <div
            className="px-2 py-1 bg-cave-ember/80 text-cave-dark text-xs rounded-md font-medium"
            title="Using fallback image due to validation or loading issues"
            aria-label="Fallback image in use"
          >
            Fallback
          </div>
        </motion.div>
      )}

      {/* Enhanced accessibility: Screen reader status updates */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {isLoading && `Carregando nova imagem do Capitão Caverna (${imageLoadProgress}%)`}
        {isGenerating && 'Gerando nova imagem contextual do Capitão Caverna'}
        {hasError && retryCount > 0 && `Erro ao carregar imagem do Capitão Caverna - Tentativa ${retryCount + 1}`}
        {hasError && retryCount === 0 && 'Erro ao carregar imagem do Capitão Caverna'}
        {!isLoading && !isGenerating && !hasError && `Imagem do Capitão Caverna carregada com sucesso - Variação ${contextualVariation}${validationResult ? ` - Score de validação: ${validationResult.score}` : ''}${usedFallback ? ' - Usando imagem de fallback' : ''}`}
      </div>
    </motion.div>
  );
};

export default CaptainImage;