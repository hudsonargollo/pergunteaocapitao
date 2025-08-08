'use client';

import AnimatedAIChat from '@/app/components/ui/animated-ai-chat';

export default function Home() {
  return (
    <div className="h-full w-full flex flex-col">
      {/* Enhanced container with responsive design and proper spacing */}
      <div className="flex-1 min-h-0 w-full max-w-full mx-auto">
        <AnimatedAIChat
          initialMessage="Guerreiro, bem-vindo à caverna! Sou o Capitão Caverna, seu mentor implacável no caminho da disciplina e transformação. Estou aqui para te guiar através do Modo Caverna - onde propósito, foco e progresso se encontram. Não espere palavras doces ou consolos vazios. Aqui, enfrentamos a realidade de frente e construímos a versão mais forte de você mesmo. O que te trouxe até aqui hoje?"
          onMessageSent={(message) => {
            console.log('Main page: Message sent:', message);
            
            // Enhanced logging for better debugging
            console.log('Message details:', {
              timestamp: new Date().toISOString(),
              messageLength: message.length,
              wordCount: message.split(' ').length
            });
          }}
          onResponseReceived={(response) => {
            console.log('Main page: Response received:', {
              hasImage: !!response?.imageUrl,
              responseLength: response?.response?.length || 0,
              conversationId: response?.conversationId,
              timestamp: new Date().toISOString()
            });
            
            // Enhanced analytics for response tracking
            if (response?.imageUrl) {
              console.log('Captain image updated:', {
                imageUrl: response.imageUrl,
                conversationId: response.conversationId
              });
            }
          }}
          className="h-full w-full"
        />
      </div>
    </div>
  );
}
