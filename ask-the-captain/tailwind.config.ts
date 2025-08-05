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
          light: {
            warm: "hsl(var(--cave-light-warm))",
            cool: "hsl(var(--cave-light-cool))",
          },
          ember: "hsl(var(--cave-ember))",
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
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "cave-glow": "cave-glow 3s ease-in-out infinite",
        "ember-flicker": "ember-flicker 2s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;