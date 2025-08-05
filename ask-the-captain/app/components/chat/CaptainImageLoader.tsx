'use client';

import React from 'react';
import { cn } from '@/app/lib/utils';

interface CaptainImageLoaderProps {
  isGenerating?: boolean;
  isLoading?: boolean;
  hasError?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const CaptainImageLoader: React.FC<CaptainImageLoaderProps> = ({
  isGenerating = false,
  isLoading = false,
  hasError = false,
  size = 'md',
  className
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

  // Cave-themed spinner component
  const CaveSpinner = () => (
    <div className="relative">
      {/* Main spinner ring */}
      <div 
        className={cn(
          config.spinner,
          'border-primary/30 border-t-primary rounded-full animate-spin',
          'shadow-glow'
        )}
        aria-hidden="true"
      />
      
      {/* Inner glow effect */}
      <div 
        className={cn(
          config.spinner,
          'absolute inset-0 border-primary/10 border-t-primary/50 rounded-full animate-spin',
          'animate-pulse'
        )}
        style={{ animationDirection: 'reverse', animationDuration: '3s' }}
        aria-hidden="true"
      />
      
      {/* Center ember effect */}
      <div 
        className="absolute inset-0 flex items-center justify-center"
        aria-hidden="true"
      >
        <div 
          className="w-1 h-1 bg-cave-ember rounded-full animate-pulse shadow-glow"
          style={{ 
            boxShadow: '0 0 4px hsl(var(--cave-ember)), 0 0 8px hsl(var(--cave-ember))' 
          }}
        />
      </div>
    </div>
  );

  // Generating animation with enhanced cave effects
  const GeneratingAnimation = () => (
    <div className="relative">
      {/* Outer ring with cave glow */}
      <div 
        className={cn(
          config.spinner,
          'border-2 border-primary/20 rounded-full animate-spin',
          'shadow-glow-strong'
        )}
        style={{ animationDuration: '2s' }}
        aria-hidden="true"
      />
      
      {/* Middle ring */}
      <div 
        className={cn(
          config.spinner,
          'absolute inset-1 border-2 border-accent/30 rounded-full animate-spin',
          'shadow-glow'
        )}
        style={{ 
          animationDirection: 'reverse', 
          animationDuration: '3s' 
        }}
        aria-hidden="true"
      />
      
      {/* Inner core with pulsing effect */}
      <div 
        className="absolute inset-0 flex items-center justify-center"
        aria-hidden="true"
      >
        <div 
          className={cn(
            'w-3 h-3 bg-gradient-to-br from-primary to-accent rounded-full',
            'animate-pulse shadow-glow-strong'
          )}
          style={{
            animation: 'pulse 1.5s ease-in-out infinite, cave-glow 2s ease-in-out infinite'
          }}
        />
      </div>
      
      {/* Surrounding ember particles */}
      <div className="absolute inset-0" aria-hidden="true">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="absolute w-0.5 h-0.5 bg-cave-ember rounded-full animate-ping"
            style={{
              top: `${20 + Math.sin(i * Math.PI / 3) * 30}%`,
              left: `${50 + Math.cos(i * Math.PI / 3) * 30}%`,
              animationDelay: `${i * 0.3}s`,
              animationDuration: '2s'
            }}
          />
        ))}
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
      
      {/* Loading text */}
      <span 
        className={cn(
          config.text,
          'font-medium text-center',
          loadingState === 'error' ? 'text-destructive' : 'text-cave-secondary'
        )}
      >
        {getLoadingMessage()}
      </span>
      
      {/* Screen reader text */}
      <span className="sr-only">
        {loadingState === 'generating' && 'Gerando nova imagem contextual do Capitão Caverna'}
        {loadingState === 'loading' && 'Carregando imagem do Capitão Caverna'}
        {loadingState === 'error' && 'Erro ao carregar imagem do Capitão Caverna'}
      </span>
    </div>
  );
};

export default CaptainImageLoader;