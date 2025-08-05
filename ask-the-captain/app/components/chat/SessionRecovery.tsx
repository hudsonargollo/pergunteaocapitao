'use client';

import React, { useState, useEffect } from 'react';
import { RefreshCw, AlertCircle, CheckCircle, X } from 'lucide-react';
import { Button } from '@/app/components/ui/button';

interface SessionRecoveryProps {
  sessionId: string;
  conversationId?: string;
  messageCount: number;
  lastActivity: Date;
  onRecover: () => void;
  onStartFresh: () => void;
  onDismiss: () => void;
  autoRecoverAfter?: number; // seconds
}

const SessionRecovery: React.FC<SessionRecoveryProps> = ({
  sessionId,
  conversationId,
  messageCount,
  lastActivity,
  onRecover,
  onStartFresh,
  onDismiss,
  autoRecoverAfter = 10
}) => {
  const [countdown, setCountdown] = useState(autoRecoverAfter);
  const [isAutoRecovering, setIsAutoRecovering] = useState(false);

  // Auto-recovery countdown
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(prev => prev - 1);
      }, 1000);
      
      return () => clearTimeout(timer);
    } else {
      // Auto-recover when countdown reaches 0
      setIsAutoRecovering(true);
      setTimeout(() => {
        onRecover();
      }, 500);
    }
  }, [countdown, onRecover]);

  // Format time since last activity
  const formatTimeSince = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMins / 60);
    
    if (diffHours > 0) {
      return `${diffHours}h ${diffMins % 60}m atrás`;
    } else if (diffMins > 0) {
      return `${diffMins}m atrás`;
    } else {
      return 'agora mesmo';
    }
  };

  const handleRecover = () => {
    setIsAutoRecovering(true);
    setTimeout(() => {
      onRecover();
    }, 300);
  };

  const handleStartFresh = () => {
    onStartFresh();
  };

  const handleDismiss = () => {
    onDismiss();
  };

  if (isAutoRecovering) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="glass-medium rounded-3xl p-8 max-w-md w-full text-center card-elevated animate-cave-glow">
          <div className="animate-spin w-12 h-12 mx-auto mb-4">
            <RefreshCw className="w-12 h-12 text-cave-accent" />
          </div>
          <h3 className="text-xl font-bold text-cave-primary mb-2">
            Recuperando Sessão
          </h3>
          <p className="text-cave-secondary">
            Restaurando sua conversa com o Capitão...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="glass-medium rounded-3xl p-8 max-w-lg w-full card-elevated hover-cave-glow">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="glass-subtle w-12 h-12 rounded-2xl flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-cave-accent" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-cave-primary">
                Sessão Anterior Encontrada
              </h3>
              <p className="text-sm text-cave-secondary/80">
                Última atividade: {formatTimeSince(lastActivity)}
              </p>
            </div>
          </div>
          
          <Button
            onClick={handleDismiss}
            variant="ghost"
            size="sm"
            className="text-cave-secondary/60 hover:text-cave-primary"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Session Info */}
        <div className="glass-subtle rounded-2xl p-4 mb-6">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-cave-secondary/70 mb-1">Sessão</p>
              <p className="text-cave-primary font-medium">
                {sessionId.split('_')[1]}
              </p>
            </div>
            <div>
              <p className="text-cave-secondary/70 mb-1">Mensagens</p>
              <p className="text-cave-primary font-medium">
                {messageCount} mensagens
              </p>
            </div>
            {conversationId && (
              <div className="col-span-2">
                <p className="text-cave-secondary/70 mb-1">Conversa</p>
                <p className="text-cave-primary font-medium text-xs">
                  {conversationId}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Description */}
        <div className="mb-6">
          <p className="text-cave-secondary leading-relaxed">
            Encontramos uma sessão anterior com o Capitão. Você pode continuar de onde parou 
            ou começar uma nova jornada.
          </p>
        </div>

        {/* Auto-recovery countdown */}
        <div className="glass-border rounded-2xl p-4 mb-6 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <CheckCircle className="w-4 h-4 text-green-500" />
            <span className="text-sm font-medium text-cave-primary">
              Recuperação Automática
            </span>
          </div>
          <p className="text-xs text-cave-secondary/80">
            Continuando automaticamente em {countdown} segundos
          </p>
          <div className="w-full bg-cave-secondary/20 rounded-full h-1 mt-2">
            <div 
              className="bg-cave-accent h-1 rounded-full transition-all duration-1000"
              style={{ 
                width: `${((autoRecoverAfter - countdown) / autoRecoverAfter) * 100}%` 
              }}
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <Button
            onClick={handleRecover}
            variant="default"
            className="flex-1 font-semibold shadow-glow hover:shadow-glow-strong"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Continuar Sessão
          </Button>
          
          <Button
            onClick={handleStartFresh}
            variant="cave"
            className="flex-1 font-semibold"
          >
            Nova Sessão
          </Button>
        </div>

        {/* Footer */}
        <div className="mt-4 pt-4 border-t border-cave-secondary/20">
          <p className="text-xs text-cave-secondary/60 text-center">
            Suas conversas são salvas automaticamente para melhor experiência
          </p>
        </div>
      </div>
    </div>
  );
};

export default SessionRecovery;