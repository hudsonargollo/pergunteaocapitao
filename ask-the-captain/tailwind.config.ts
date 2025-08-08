import type { Config } from "tailwindcss";

export default {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: {
          DEFAULT: "hsl(var(--background))",
          secondary: "hsl(var(--background-secondary))",
        },
        foreground: "hsl(var(--foreground))",
        glass: {
          DEFAULT: "hsl(var(--glass))",
          light: "hsl(var(--glass-light))",
          lighter: "hsl(var(--glass-lighter))",
          border: "hsl(var(--glass-border))",
        },
        chat: {
          background: "hsl(var(--chat-background))",
          user: "hsl(var(--chat-user))",
          ai: "hsl(var(--chat-ai))",
        },
        cave: {
          // Enhanced Cavernous Tech palette
          dark: '#0A0A0B',
          charcoal: '#1C1C1C', 
          stone: '#3C3C3C',
          red: '#FF3333',
          ember: '#FFA500',
          torch: '#FFD700',
          white: '#FFFFFF',
          offWhite: '#E0E0E0',
          mist: '#B0B0B0',
          light: {
            warm: "hsl(var(--cave-light-warm))",
            cool: "hsl(var(--cave-light-cool))",
          },
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      backgroundImage: {
        'gradient-glass': 'var(--gradient-glass)',
        'gradient-border': 'var(--gradient-border)',
        'gradient-chat-user': 'var(--gradient-chat-user)',
        'gradient-chat-ai': 'var(--gradient-chat-ai)',
      },
      boxShadow: {
        'glass': 'var(--shadow-glass)',
        'glass-medium': 'var(--shadow-glass-medium)',
        'glass-strong': 'var(--shadow-glass-strong)',
        'glass-inset': 'var(--shadow-glass-inset)',
        'glow': 'var(--shadow-glow)',
        'glow-strong': 'var(--shadow-glow-strong)',
      },
      backdropBlur: {
        'cave': '28px',
        'cave-medium': '36px',
        'cave-strong': '44px',
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "cave-glow": {
          "0%, 100%": { 
            boxShadow: "var(--shadow-glow)",
            opacity: "0.8"
          },
          "50%": { 
            boxShadow: "var(--shadow-glow-strong)",
            opacity: "1"
          },
        },
        "ember-flicker": {
          "0%, 100%": { opacity: "0.8" },
          "25%": { opacity: "1" },
          "50%": { opacity: "0.9" },
          "75%": { opacity: "1" },
        },
        // Enhanced keyframes for animated chat component
        "message-slide-in": {
          "0%": { 
            opacity: "0", 
            transform: "translateY(20px) scale(0.95)" 
          },
          "100%": { 
            opacity: "1", 
            transform: "translateY(0) scale(1)" 
          },
        },
        "typing-pulse": {
          "0%, 100%": { 
            opacity: "0.4",
            transform: "scale(1)"
          },
          "50%": { 
            opacity: "1",
            transform: "scale(1.1)"
          },
        },
        "captain-entrance": {
          "0%": { 
            opacity: "0", 
            transform: "scale(0.8) rotate(-5deg)" 
          },
          "50%": { 
            opacity: "0.8", 
            transform: "scale(1.05) rotate(2deg)" 
          },
          "100%": { 
            opacity: "1", 
            transform: "scale(1) rotate(0deg)" 
          },
        },
        "ripple": {
          "0%": { 
            transform: "scale(0)", 
            opacity: "0.8" 
          },
          "100%": { 
            transform: "scale(4)", 
            opacity: "0" 
          },
        },
        "cave-shimmer": {
          "0%": { 
            backgroundPosition: "-200% 0" 
          },
          "100%": { 
            backgroundPosition: "200% 0" 
          },
        },
        "torch-flicker": {
          "0%, 100%": { 
            opacity: "1",
            filter: "brightness(1) hue-rotate(0deg)"
          },
          "25%": { 
            opacity: "0.9",
            filter: "brightness(1.1) hue-rotate(5deg)"
          },
          "50%": { 
            opacity: "0.95",
            filter: "brightness(0.9) hue-rotate(-3deg)"
          },
          "75%": { 
            opacity: "0.85",
            filter: "brightness(1.05) hue-rotate(2deg)"
          },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "cave-glow": "cave-glow 3s ease-in-out infinite",
        "ember-flicker": "ember-flicker 2s ease-in-out infinite",
        // Enhanced animations for animated chat component
        "message-slide-in": "message-slide-in 0.3s ease-out",
        "typing-pulse": "typing-pulse 1.5s ease-in-out infinite",
        "captain-entrance": "captain-entrance 0.5s ease-out",
        "ripple": "ripple 0.6s ease-out",
        "cave-shimmer": "cave-shimmer 2s infinite",
        "torch-flicker": "torch-flicker 2.5s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;