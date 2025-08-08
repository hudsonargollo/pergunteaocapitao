import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Ask the Captain - Modo Caverna",
  description: "Seu mentor implacável no Modo Caverna. Propósito > Foco > Progresso. Orientação direta e sem rodeios para guerreiros que recusam a mediocridade.",
  keywords: "Modo Caverna, disciplina, transformação, foco, propósito, progresso, mentor, guerreiro",
  authors: [{ name: "Modo Caverna" }],
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#FF3333',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="h-full" suppressHydrationWarning={true}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased h-full overflow-hidden`}
      >
        {/* Enhanced cave atmosphere with responsive design */}
        <div className="h-full w-full bg-gradient-to-br from-cave-dark via-cave-charcoal to-cave-stone relative">
          {/* Cave atmosphere background effects - optimized for all screen sizes */}
          <div className="fixed inset-0 pointer-events-none overflow-hidden">
            {/* Ambient cave lighting - responsive positioning */}
            <div className="absolute top-0 left-1/4 w-64 h-64 sm:w-80 sm:h-80 lg:w-96 lg:h-96 bg-cave-red/5 rounded-full blur-3xl animate-torch-flicker" />
            <div className="absolute bottom-1/4 right-1/4 w-56 h-56 sm:w-72 sm:h-72 lg:w-80 lg:h-80 bg-cave-ember/4 rounded-full blur-3xl animate-ember-flicker" />
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 sm:w-96 sm:h-96 lg:w-[600px] lg:h-[600px] bg-cave-red/3 rounded-full blur-3xl animate-cave-glow" />

            {/* Additional mobile-optimized lighting effects */}
            <div className="absolute top-1/4 right-0 w-48 h-48 sm:w-64 sm:h-64 bg-cave-ember/3 rounded-full blur-2xl animate-ember-flicker opacity-60" />
            <div className="absolute bottom-0 left-0 w-52 h-52 sm:w-72 sm:h-72 bg-cave-red/4 rounded-full blur-3xl animate-torch-flicker opacity-40" />

            {/* Cave texture overlay - enhanced for depth */}
            <div className="absolute inset-0 opacity-15 sm:opacity-20 bg-gradient-to-br from-transparent via-cave-stone/10 to-transparent" />
            <div className="absolute inset-0 opacity-10 bg-gradient-to-tr from-cave-red/5 via-transparent to-cave-ember/5" />

            {/* Enhanced noise texture for cave walls - responsive sizing */}
            <div
              className="absolute inset-0 opacity-3 sm:opacity-5"
              style={{
                backgroundImage: `radial-gradient(circle at 25% 25%, rgba(255, 51, 51, 0.1) 0%, transparent 50%),
                                 radial-gradient(circle at 75% 75%, rgba(255, 165, 0, 0.08) 0%, transparent 50%),
                                 radial-gradient(circle at 50% 50%, rgba(255, 51, 51, 0.05) 0%, transparent 70%),
                                 radial-gradient(circle at 10% 90%, rgba(255, 165, 0, 0.06) 0%, transparent 40%)`,
                backgroundSize: '300px 300px, 250px 250px, 400px 400px, 200px 200px',
                backgroundPosition: '0 0, 100px 100px, 200px 200px, 300px 50px'
              }}
            />

            {/* Subtle animated particles for cave atmosphere */}
            <div className="absolute inset-0">
              <div className="absolute top-1/3 left-1/5 w-1 h-1 bg-cave-ember/30 rounded-full animate-ember-drift"
                style={{ animationDelay: '0s', animationDuration: '4s' }} />
              <div className="absolute top-2/3 right-1/3 w-1 h-1 bg-cave-red/20 rounded-full animate-ember-drift"
                style={{ animationDelay: '1.5s', animationDuration: '5s' }} />
              <div className="absolute bottom-1/3 left-2/3 w-1 h-1 bg-cave-ember/25 rounded-full animate-ember-drift"
                style={{ animationDelay: '3s', animationDuration: '6s' }} />
            </div>
          </div>

          {/* Enhanced main application content with better responsive structure */}
          <main className="relative z-10 h-full w-full flex flex-col">
            {/* Optional header space for future navigation */}
            <div className="flex-shrink-0 h-0" />

            {/* Main content area - optimized for chat interface */}
            <div className="flex-1 min-h-0 w-full max-w-full">
              {children}
            </div>

            {/* Optional footer space for future elements */}
            <div className="flex-shrink-0 h-0" />
          </main>

          {/* Enhanced accessibility and performance optimizations */}
          <div className="sr-only" aria-live="polite" id="cave-announcements" />
        </div>
      </body>
    </html>
  );
}
