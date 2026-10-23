import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./client/index.html", "./client/src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    container: {
      center: true,
      padding: "1rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        medieval: ["MedievalSharp", "cursive"],
        display: ["Cinzel Decorative", "serif"],
        heading: ["Uncial Antiqua", "cursive"],
        pixel: ["MedievalSharp", "cursive"],
        cinzel: ["Cinzel", "serif"],
        cormorant: ["Cormorant", "serif"],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        highlight: "hsl(var(--highlight))",
      },
      backgroundImage: {
        'medieval-light': "url('data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M54.627 0l.83.828-1.415 1.415L51.8 0h2.827zM5.373 0l-.83.828L5.96 2.243 8.2 0H5.374zM48.97 0l3.657 3.657-1.414 1.414L46.143 0h2.828zM11.03 0L7.372 3.657 8.787 5.07 13.857 0H11.03zm32.284 0L49.8 6.485 48.384 7.9l-7.9-7.9h2.83zM16.686 0L10.2 6.485 11.616 7.9l7.9-7.9h-2.83zM22.343 0L13.858 8.485 15.272 9.9l7.9-7.9h-.828zm5.657 0L19.515 8.485 20.93 9.9l8.485-8.485h-1.414zM32.343 0L26.686 5.657 28.1 7.07l5.657-5.657h-1.414zM38 0l-3.657 3.657 1.414 1.414L39.414 0H38zm-6.343 0L28.1 3.657 29.515 5.07 35.172 0h-3.515zM44 0l-3.657 3.657 1.414 1.414L45.414 0H44zM0 2.828l2.828-2.828h1.414L1.414 2.828H0zm0 5.657l8.485-8.485h1.414L1.414 8.485H0zm0 5.657l8.485-8.485h1.414L1.414 14.142H0zm0 5.657l8.485-8.485h1.414L1.414 19.8H0zm0 5.657l8.485-8.485h1.414L1.414 25.456H0zm0 5.657l8.485-8.485h1.414L1.414 31.113H0zm0 5.657l8.485-8.485h1.414L1.414 36.77H0zm0 5.657l8.485-8.485h1.414L1.414 42.427H0zm0 5.657l8.485-8.485h1.414L1.414 48.084H0zm0 5.657l8.485-8.485h1.414L1.414 53.74H0zm0 5.657l8.485-8.485h1.414L1.414 59.398H0zm5.657 0l8.485-8.485h1.414L7.07 59.398H5.657zm5.657 0l8.485-8.485h1.414l-8.485 8.485h-1.414zm5.657 0l8.485-8.485h1.414l-8.485 8.485h-1.414zm5.657 0l8.485-8.485h1.414l-8.485 8.485h-1.414zm5.657 0l8.485-8.485h1.414l-8.485 8.485h-1.414zm5.657 0l8.485-8.485h1.414l-8.485 8.485h-1.414zm5.657 0l8.485-8.485h1.414l-8.485 8.485h-1.414zm5.657 0l8.485-8.485h1.414l-8.485 8.485h-1.414zm5.657 0l8.485-8.485h1.414l-8.485 8.485h-1.414z' fill='%23D4AF37' fill-opacity='0.1' fill-rule='evenodd'/%3E%3C/svg%3E')",
        'medieval-dark': "url('data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M54.627 0l.83.828-1.415 1.415L51.8 0h2.827zM5.373 0l-.83.828L5.96 2.243 8.2 0H5.374zM48.97 0l3.657 3.657-1.414 1.414L46.143 0h2.828zM11.03 0L7.372 3.657 8.787 5.07 13.857 0H11.03zm32.284 0L49.8 6.485 48.384 7.9l-7.9-7.9h2.83zM16.686 0L10.2 6.485 11.616 7.9l7.9-7.9h-2.83zM22.343 0L13.858 8.485 15.272 9.9l7.9-7.9h-.828zm5.657 0L19.515 8.485 20.93 9.9l8.485-8.485h-1.414zM32.343 0L26.686 5.657 28.1 7.07l5.657-5.657h-1.414zM38 0l-3.657 3.657 1.414 1.414L39.414 0H38zm-6.343 0L28.1 3.657 29.515 5.07 35.172 0h-3.515zM44 0l-3.657 3.657 1.414 1.414L45.414 0H44zM0 2.828l2.828-2.828h1.414L1.414 2.828H0zm0 5.657l8.485-8.485h1.414L1.414 8.485H0zm0 5.657l8.485-8.485h1.414L1.414 14.142H0zm0 5.657l8.485-8.485h1.414L1.414 19.8H0zm0 5.657l8.485-8.485h1.414L1.414 25.456H0zm0 5.657l8.485-8.485h1.414L1.414 31.113H0zm0 5.657l8.485-8.485h1.414L1.414 36.77H0zm0 5.657l8.485-8.485h1.414L1.414 42.427H0zm0 5.657l8.485-8.485h1.414L1.414 48.084H0zm0 5.657l8.485-8.485h1.414L1.414 53.74H0zm0 5.657l8.485-8.485h1.414L1.414 59.398H0zm5.657 0l8.485-8.485h1.414L7.07 59.398H5.657zm5.657 0l8.485-8.485h1.414l-8.485 8.485h-1.414zm5.657 0l8.485-8.485h1.414l-8.485 8.485h-1.414zm5.657 0l8.485-8.485h1.414l-8.485 8.485h-1.414zm5.657 0l8.485-8.485h1.414l-8.485 8.485h-1.414zm5.657 0l8.485-8.485h1.414l-8.485 8.485h-1.414zm5.657 0l8.485-8.485h1.414l-8.485 8.485h-1.414zm5.657 0l8.485-8.485h1.414l-8.485 8.485h-1.414zm5.657 0l8.485-8.485h1.414l-8.485 8.485h-1.414z' fill='%234A148C' fill-opacity='0.2' fill-rule='evenodd'/%3E%3C/svg%3E')",
      },
      boxShadow: {
        'medieval': '3px 3px 5px rgba(0,0,0,0.2), inset 0 0 10px rgba(0,0,0,0.1)',
      },
      animation: {
        'medieval-float': 'medieval-float 3s ease-in-out infinite',
        'medieval-pulse': 'medieval-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'medieval-glow': 'medieval-glow 2s ease-in-out infinite',
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.5s ease-out",
        "fade-out": "fade-out 0.5s ease-out",
        "slide-in": "slide-in 0.3s ease-out",
        "slide-out": "slide-out 0.3s ease-out",
        "scale-in": "scale-in 0.2s ease-out",
        "scale-out": "scale-out 0.2s ease-out",
        "subtle-flicker": "subtle-flicker 3s ease-in-out infinite",
        "shine": "shine 3s linear infinite",
      },
      keyframes: {
        'medieval-float': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        'medieval-pulse': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '.7' },
        },
        'medieval-glow': {
          '0%, 100%': {
            boxShadow: '0 0 15px rgba(var(--highlight), 0.3)',
          },
          '50%': {
            boxShadow: '0 0 30px rgba(var(--highlight), 0.6)',
          },
        },
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "fade-out": {
          "0%": { opacity: "1" },
          "100%": { opacity: "0" },
        },
        "slide-in": {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(0)" },
        },
        "slide-out": {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(100%)" },
        },
        "scale-in": {
          "0%": { transform: "scale(0.95)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        "scale-out": {
          "0%": { transform: "scale(1)", opacity: "1" },
          "100%": { transform: "scale(0.95)", opacity: "0" },
        },
        "subtle-flicker": {
          "0%, 100%": { opacity: "0.9" },
          "50%": { opacity: "1" },
        },
        "shine": {
          "0%": { transform: "rotate(45deg) translateX(-150%)" },
          "100%": { transform: "rotate(45deg) translateX(150%)" },
        },
      },
    },
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
} satisfies Config;
