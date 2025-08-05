'use client';

import React, { useEffect, useState } from 'react';
import { MessageCircle, Target, Zap, Shield } from 'lucide-react';
import { Button } from '@/app/components/ui/button';

interface WelcomeMessageProps {
  onStartConversation?: () => void;
  onQuickStart?: (message: string) => void;
  captainImageUrl?: string;
}

const WelcomeMessage: React.FC<WelcomeMessageProps> = ({
  onStartConversation,
  onQuickStart,
  captainImageUrl
}) => {
  const [isVisible, setIsVisible] = useState(false);

  // Animate entrance
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 300);
    return () => clearTimeout(timer);
  }, []);

  // Quick start suggestions based on Modo Caverna methodology
  const quickStartSuggestions = [
    {
      icon: Target,
      title: "Definir Propósito",
      message: "Como posso descobrir meu verdadeiro propósito e parar de viver no piloto automático?",
      description: "Encontre sua direção verdadeira"
    },
    {
      icon: Zap,
      title: "Aumentar Foco",
      message: "Quais são as estratégias mais eficazes para eliminar distrações e manter foco total?",
      description: "Elimine distrações e concentre-se"
    },
    {
      icon: Shield,
      title: "Vencer Procrastinação",
      message: "Como posso quebrar o ciclo da procrastinação e começar a agir de verdade?",
      description: "Transforme intenção em ação"
    }
  ];

  const handleQuickStart = (message: string) => {
    onQuickStart?.(message);
  };

  return (
    <div 
      className={`text-center py-12 cave-lighting transition-all duration-1000 ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
      }`} 
      role="banner"
    >
      {/* Captain Introduction Section */}
      <div className="mb-12">
        {/* Captain Avatar with Default Image */}
        <div 
          className="glass-medium w-32 h-32 rounded-3xl mx-auto mb-8 flex items-center justify-center hover-cave-lift animate-cave-glow card-elevated"
          aria-label="Avatar do Capitão Caverna"
        >
          {captainImageUrl ? (
            <img 
              src={captainImageUrl} 
              alt="Capitão Caverna" 
              className="w-full h-full object-cover rounded-3xl"
              onError={(e) => {
                // Fallback to emoji if image fails
                e.currentTarget.style.display = 'none';
                e.currentTarget.nextElementSibling?.classList.remove('hidden');
              }}
            />
          ) : null}
          <span 
            className={`text-6xl animate-ember-flicker ${captainImageUrl ? 'hidden' : ''}`} 
            aria-hidden="true"
          >
            🐺
          </span>
        </div>
        
        {/* Welcome Title */}
        <h2 
          className="text-3xl md:text-4xl font-bold text-cave-accent mb-4 animate-ember-flicker"
          id="welcome-title"
        >
          Bem-vindo à Caverna, Guerreiro
        </h2>
        
        {/* Decorative Divider */}
        <div className="divider-cave max-w-lg mx-auto mb-6" aria-hidden="true"></div>
        
        {/* Captain Introduction */}
        <div className="max-w-2xl mx-auto space-y-4">
          <p 
            className="text-xl text-cave-secondary font-medium leading-relaxed"
            aria-describedby="welcome-title"
          >
            Eu sou o <strong className="text-cave-accent">Capitão Caverna</strong>, seu mentor implacável no Modo Caverna.
          </p>
          
          <p className="text-lg text-cave-secondary/90 leading-relaxed">
            Você finalmente acordou e chegou até aqui. Isso significa que está pronto para abandonar a mediocridade 
            e abraçar a disciplina que transforma guerreiros.
          </p>
          
          {/* Philosophy Statement */}
          <div className="glass-subtle rounded-2xl p-6 my-8 card-elevated">
            <p 
              className="text-cave-ember font-bold text-lg mb-2 tracking-wide"
              role="text"
              aria-label="Filosofia do Modo Caverna"
            >
              PROPÓSITO → FOCO → PROGRESSO
            </p>
            <p className="text-cave-secondary text-sm">
              Sem rodeios, sem desculpas, sem vitimismo. Apenas ação e disciplina.
            </p>
          </div>
        </div>
      </div>

      {/* Quick Start Section */}
      <div className="mb-12">
        <h3 className="text-xl font-bold text-cave-primary mb-6">
          Por onde você quer começar sua transformação?
        </h3>
        
        <div className="grid md:grid-cols-3 gap-4 max-w-4xl mx-auto">
          {quickStartSuggestions.map((suggestion, index) => {
            const IconComponent = suggestion.icon;
            return (
              <Button
                key={index}
                onClick={() => handleQuickStart(suggestion.message)}
                variant="cave"
                className="glass-border p-6 h-auto flex flex-col items-center text-center space-y-3 hover-cave-glow card-elevated group transition-all duration-300"
                aria-label={`Começar com: ${suggestion.title}`}
              >
                <div className="glass-medium w-12 h-12 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  <IconComponent className="h-6 w-6 text-cave-accent" />
                </div>
                <div>
                  <h4 className="font-bold text-cave-primary mb-1">{suggestion.title}</h4>
                  <p className="text-xs text-cave-secondary/80 leading-relaxed">
                    {suggestion.description}
                  </p>
                </div>
              </Button>
            );
          })}
        </div>
      </div>

      {/* Call to Action */}
      <div className="space-y-6">
        <div 
          className="text-cave-secondary/80 font-medium"
          role="text"
          aria-label="Descrição da plataforma"
        >
          Este é seu refúgio estratégico para escapar da mediocridade
        </div>
        
        {/* Primary CTA */}
        <div className="space-y-4">
          <p className="text-cave-primary font-semibold">
            Faça sua pergunta ou escolha uma das opções acima para começar
          </p>
          
          {/* Session Start Button */}
          <Button
            onClick={onStartConversation}
            variant="default"
            size="lg"
            className="glass-border px-8 py-3 font-bold hover:scale-105 shadow-glow hover:shadow-glow-strong transition-all duration-300 card-elevated"
            aria-label="Iniciar nova conversa com o Capitão"
          >
            <MessageCircle className="h-5 w-5 mr-2" />
            Iniciar Conversa
          </Button>
        </div>
        
        {/* Guidance Text */}
        <div 
          className="mt-8 text-sm text-cave-secondary/60 font-medium max-w-md mx-auto leading-relaxed"
          role="text"
          aria-label="Instrução para começar"
        >
          Digite sua pergunta no campo abaixo ou clique em uma das sugestões. 
          Cada resposta virá acompanhada de uma imagem única do Capitão.
        </div>
      </div>

      {/* Session Info */}
      <div className="mt-12 pt-8 border-t border-cave-secondary/20">
        <div className="text-xs text-cave-secondary/50 space-y-1">
          <p>Sua conversa será salva automaticamente nesta sessão</p>
          <p>Todas as interações seguem a metodologia Modo Caverna</p>
        </div>
      </div>
    </div>
  );
};

export default WelcomeMessage;