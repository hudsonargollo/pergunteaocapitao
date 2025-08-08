'use client';

import React from 'react';
import { cn } from '@/app/lib/utils';

interface CaptainImageLoaderProps {
  isGenerating?: boolean;
  isLoading?: boolean;
  hasError?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  contextualVariation?: 'supportive' | 'challenging' | 'instructional' | 'motivational' | 'default';
  progress?: number;
  retryCount?: number;
}

const CaptainImageLoader: React.FC<CaptainImageLoaderProps> = ({
  isGenerating = false,
  isLoading = false,
  hasError = false,
  size = 'md',
  className,
  contextualVariation = 'default',
  progress = 0,
  retryCount = 0
}) => {
  // Size configurations for different loader sizes
  const sizeConfig = {
    sm: {
      container: 'w-6 h-6',
      spinner: 'w-4 h-4 border-2',
      text: 'text-xs',
      icon: 'text-sm'
    },
    md: {
      container: 'w-8 h-8',
      spinner: 'w-6 h-6 border-2',
      text: 'text-xs',
      icon: 'text-base'
    },
    lg: {
      container: 'w-10 h-10',
      spinner: 'w-8 h-8 border-3',
      text: 'text-sm',
      icon: 'text-lg'
    },
    xl: {
      container: 'w-12 h-12',
      spinner: 'w-10 h-10 border-3',
      text: 'text-base',
      icon: 'text-xl'
    }
  };

  const config = sizeConfig[size];

  // Get the appropriate loading state
  const getLoadingState = () => {
    if (hasError) return 'error';
    if (isGenerating) return 'generating';
    if (isLoading) return 'loading';
    return 'idle';
  };

  const loadingState = getLoadingState();

  // Get contextual colors based on variation
  const getContextualColors = () => {
    switch (contextualVariation) {
      case 'supportive':
        return {
          primary: 'border-cave-ember/40 border-t-cave-ember',
          secondary: 'border-cave-ember/20 border-t-cave-ember/60',
          center: 'bg-cave-ember',
          glow: 'shadow-[0_0_8px_rgba(255,165,0,0.6)]'
        };
      case 'challenging':
        return {
          primary: 'border-cave-red/40 border-t-cave-red',
          secondary: 'border-cave-red/20 border-t-cave-red/60',
          center: 'bg-cave-red',
          glow: 'shadow-[0_0_8px_rgba(255,51,51,0.6)]'
        };
      case 'instructional':
        return {
          primary: 'border-cave-torch/40 border-t-cave-torch',
          secondary: 'border-cave-torch/20 border-t-cave-torch/60',
          center: 'bg-cave-torch',
          glow: 'shadow-[0_0_8px_rgba(255,215,0,0.6)]'
        };
      case 'motivational':
        return {
          primary: 'border-cave-red/50 border-t-cave-red',
          secondary: 'border-cave-red/25 border-t-cave-red/70',
          center: 'bg-cave-red',
          glow: 'shadow-[0_0_12px_rgba(255,51,51,0.8)]'
        };
      default:
        return {
          primary: 'border-primary/30 border-t-primary',
          secondary: 'border-primary/10 border-t-primary/50',
          center: 'bg-cave-ember',
          glow: 'shadow-glow'
        };
    }
  };

  const colors = getContextualColors();

  // Enhanced cave-themed spinner component with contextual colors
  const CaveSpinner = () => (
    <div className="relative">
      {/* Main spinner ring with contextual colors */}
      <div 
        className={cn(
          config.spinner,
          colors.primary,
          'rounded-full animate-spin',
          colors.glow
        )}
        aria-hidden="true"
      />
      
      {/* Inner glow effect */}
      <div 
        className={cn(
          config.spinner,
          'absolute inset-0',
          colors.secondary,
          'rounded-full animate-spin animate-pulse'
        )}
        style={{ animationDirection: 'reverse', animationDuration: '3s' }}
        aria-hidden="true"
      />
      
      {/* Center ember effect with contextual color */}
      <div 
        className="absolute inset-0 flex items-center justify-center"
        aria-hidden="true"
      >
        <div 
          className={cn(
            'w-1 h-1 rounded-full animate-pulse',
            colors.center,
            colors.glow
          )}
        />
      </div>

      {/* Progress indicator if available */}
      {progress > 0 && (
        <div 
          className="absolute inset-0 flex items-center justify-center"
          aria-hidden="true"
        >
          <span className={cn(config.text, 'text-cave-off-white font-medium')}>
            {Math.round(progress)}%
          </span>
        </div>
      )}
    </div>
  );

  // Enhanced generating animation with contextual cave effects
  const GeneratingAnimation = () => (
    <div className="relative">
      {/* Outer ring with contextual cave glow */}
      <div 
        className={cn(
          config.spinner,
          'border-2 rounded-full animate-spin',
          colors.primary.replace('border-t-', 'border-'),
          colors.glow
        )}
        style={{ animationDuration: '2s' }}
        aria-hidden="true"
      />
      
      {/* Middle ring with contextual colors */}
      <div 
        className={cn(
          config.spinner,
          'absolute inset-1 border-2 rounded-full animate-spin',
          colors.secondary.replace('border-t-', 'border-'),
          'shadow-glow'
        )}
        style={{ 
          animationDirection: 'reverse', 
          animationDuration: '3s' 
        }}
        aria-hidden="true"
      />
      
      {/* Inner core with contextual pulsing effect */}
      <div 
        className="absolute inset-0 flex items-center justify-center"
        aria-hidden="true"
      >
        <div 
          className={cn(
            'w-3 h-3 rounded-full animate-pulse',
            colors.center,
            colors.glow
          )}
          style={{
            animation: 'pulse 1.5s ease-in-out infinite, cave-glow 2s ease-in-out infinite'
          }}
        />
      </div>
      
      {/* Surrounding ember particles with contextual colors */}
      <div className="absolute inset-0" aria-hidden="true">
        {[...Array(8)].map((_, i) => {
          const angle = (i * Math.PI * 2) / 8;
          const radius = 35;
          return (
            <div
              key={i}
              className={cn(
                'absolute w-0.5 h-0.5 rounded-full animate-ping',
                colors.center
              )}
              style={{
                top: `${50 + Math.sin(angle) * radius}%`,
                left: `${50 + Math.cos(angle) * radius}%`,
                animationDelay: `${i * 0.2}s`,
                animationDuration: '2.5s'
              }}
            />
          );
        })}
      </div>
      
      {/* Generation progress text */}
      <div 
        className="absolute inset-0 flex items-center justify-center mt-12"
        aria-hidden="true"
      >
        <span className={cn(config.text, 'text-cave-off-white/80 font-medium animate-pulse')}>
          Materializando...
        </span>
      </div>
    </div>
  );

  // Error state animation
  const ErrorAnimation = () => (
    <div className="relative">
      {/* Error ring with warning color */}
      <div 
        className={cn(
          config.spinner,
          'border-2 border-destructive/30 border-t-destructive rounded-full',
          'animate-pulse'
        )}
        aria-hidden="true"
      />
      
      {/* Warning icon in center */}
      <div 
        className="absolute inset-0 flex items-center justify-center"
        aria-hidden="true"
      >
        <span className={cn(config.icon, 'text-destructive')}>⚠️</span>
      </div>
    </div>
  );

  // Get loading message based on state
  const getLoadingMessage = () => {
    switch (loadingState) {
      case 'generating':
        return 'Gerando...';
      case 'loading':
        return 'Carregando...';
      case 'error':
        return 'Erro';
      default:
        return '';
    }
  };

  // Get appropriate animation component
  const getAnimationComponent = () => {
    switch (loadingState) {
      case 'generating':
        return <GeneratingAnimation />;
      case 'loading':
        return <CaveSpinner />;
      case 'error':
        return <ErrorAnimation />;
      default:
        return null;
    }
  };

  if (loadingState === 'idle') {
    return null;
  }

  return (
    <div 
      className={cn(
        'flex flex-col items-center justify-center space-y-2',
        'bg-glass/50 backdrop-blur-sm rounded-xl',
        'p-4',
        className
      )}
      role="status"
      aria-label={`${getLoadingMessage()} imagem do Capitão Caverna`}
    >
      {/* Animation */}
      <div className={config.container}>
        {getAnimationComponent()}
      </div>
      
      {/* Loading text with contextual information */}
      <div className="flex flex-col items-center space-y-1">
        <span 
          className={cn(
            config.text,
            'font-medium text-center',
            loadingState === 'error' ? 'text-destructive' : 'text-cave-secondary'
          )}
        >
          {getLoadingMessage()}
        </span>
        
        {/* Contextual variation indicator */}
        {contextualVariation !== 'default' && loadingState === 'generating' && (
          <span className={cn(
            'text-xs text-cave-mist/60 capitalize',
            'animate-pulse'
          )}>
            {contextualVariation}
          </span>
        )}
        
        {/* Retry count indicator */}
        {retryCount > 0 && loadingState === 'error' && (
          <span className="text-xs text-destructive/80">
            Tentativa {retryCount + 1}/3
          </span>
        )}
        
        {/* Progress percentage */}
        {progress > 0 && loadingState === 'loading' && (
          <span className="text-xs text-cave-ember font-medium">
            {Math.round(progress)}%
          </span>
        )}
      </div>
      
      {/* Enhanced screen reader text */}
      <span className="sr-only">
        {loadingState === 'generating' && `Gerando nova imagem contextual do Capitão Caverna - Variação ${contextualVariation}`}
        {loadingState === 'loading' && `Carregando imagem do Capitão Caverna ${progress > 0 ? `- ${Math.round(progress)}% concluído` : ''}`}
        {loadingState === 'error' && `Erro ao carregar imagem do Capitão Caverna${retryCount > 0 ? ` - Tentativa ${retryCount + 1} de 3` : ''}`}
      </span>
    </div>
  );
};

export default CaptainImageLoader;