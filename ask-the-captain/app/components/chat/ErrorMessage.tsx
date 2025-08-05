'use client';

import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/app/components/ui/button';

interface ChatError {
  message: string;
  type: 'network' | 'api' | 'validation' | 'unknown';
  retryable: boolean;
}

interface ErrorMessageProps {
  error: ChatError;
  onRetry?: () => void;
}

const ErrorMessage: React.FC<ErrorMessageProps> = ({ error, onRetry }) => {
  const getErrorIcon = () => {
    switch (error.type) {
      case 'network':
        return '🌐';
      case 'api':
        return '⚡';
      case 'validation':
        return '📝';
      default:
        return '⚠️';
    }
  };

  const getErrorTitle = () => {
    switch (error.type) {
      case 'network':
        return 'Problema de Conexão';
      case 'api':
        return 'Erro do Servidor';
      case 'validation':
        return 'Entrada Inválida';
      default:
        return 'Erro Desconhecido';
    }
  };

  return (
    <div className="px-6 pb-4" role="alert" aria-live="assertive">
      <div className="glass-medium rounded-2xl p-4 border-destructive/30 bg-destructive/10">
        <div className="flex items-start space-x-3">
          {/* Error Icon */}
          <div 
            className="w-10 h-10 rounded-xl bg-gradient-to-br from-destructive/40 to-destructive/20 border-2 border-destructive/60 flex items-center justify-center text-lg flex-shrink-0"
            aria-label={`Ícone de erro: ${getErrorTitle()}`}
          >
            {getErrorIcon()}
          </div>
          
          {/* Error Content */}
          <div className="flex-1 min-w-0">
            {/* Error Title */}
            <h4 className="text-sm font-semibold text-destructive mb-1">
              {getErrorTitle()}
            </h4>
            
            {/* Error Message */}
            <p className="text-sm font-medium text-destructive/90 mb-3">
              {error.message}
            </p>
            
            {/* Action Buttons */}
            <div className="flex items-center space-x-3">
              {error.retryable && onRetry && (
                <Button
                  onClick={onRetry}
                  variant="ghost"
                  size="sm"
                  className="text-cave-ember hover:text-primary h-8 px-3 font-medium"
                  aria-label="Tentar novamente"
                >
                  <RefreshCw className="h-3 w-3 mr-2" />
                  Tentar Novamente
                </Button>
              )}
              
              {/* Additional Help Text */}
              {error.type === 'validation' && (
                <span className="text-xs text-cave-secondary/70 font-medium">
                  Verifique sua mensagem e tente novamente
                </span>
              )}
              
              {error.type === 'network' && (
                <span className="text-xs text-cave-secondary/70 font-medium">
                  Verifique sua conexão com a internet
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ErrorMessage;