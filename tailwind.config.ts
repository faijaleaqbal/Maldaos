import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Institutional Malda College Palette
        maroon: {
          50: "#FAF0F2",
          100: "#F4DDE1",
          200: "#E9BCC5",
          300: "#DA93A3",
          400: "#C4657B",
          500: "#A3374E",
          600: "#8C253B",
          700: "#7A1F2B", // Deep Maroon (Primary)
          800: "#631722",
          900: "#54131D", // Dark Maroon
          950: "#380911",
        },
        gold: {
          50: "#FCF9EC",
          100: "#F9F2D2",
          200: "#F2E4A7",
          300: "#E9D275",
          400: "#DFBF4A",
          500: "#D4A72C", // Academic Gold (Accent)
          600: "#B88A1F",
          700: "#946B17",
          800: "#7A5517",
          900: "#654518",
          950: "#3B2609",
        },
        warm: {
          50: "#FDFCFA",
          100: "#F8F6F1", // Warm Off-white (Background)
          200: "#F1ECE3",
          300: "#E6DEC4",
          400: "#D6CBB9",
          500: "#BFB29C",
          600: "#A3947D",
        },
        // Restrained Diagnostic / Technical Assessment Tokens (Non-SaaS, Institutional)
        ai: {
          50: "#F8FAFC",
          100: "#F1F5F9",
          200: "#E2E8F0",
          300: "#CBD5E1",
          400: "#94A3B8",
          500: "#64748B",
          600: "#475569",
          700: "#334155",
          800: "#1E293B",
          900: "#0F172A",
          surface: "#F8FAFC",
          border: "#D1D5DB",
          text: "#1E293B",
        },
        // Semantic Application Tokens
        surface: {
          DEFAULT: "#FFFFFF",
          muted: "#F8F6F1",
          subtle: "#F4F0E8",
          border: "#E5DFD5",
          borderStrong: "#CEC5B7",
        },
        ink: {
          DEFAULT: "#171717", // Deep Ink Black
          muted: "#52525B",   // Neutral Charcoal
          soft: "#71717A",
          faint: "#A1A1AA",
        },
        status: {
          open: "#B45309",
          inProgress: "#1D4ED8",
          escalated: "#B91C1C",
          resolved: "#15803D",
          closed: "#475569",
        },
        priority: {
          low: "#15803D",
          medium: "#D97706",
          high: "#EA580C",
          critical: "#B91C1C",
        },
      },
      fontFamily: {
        serif: ["var(--font-serif)", "Georgia", "Cambria", "serif"],
        sans: ["var(--font-sans)", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
        mono: ["var(--font-mono)", "Menlo", "Courier New", "monospace"],
      },
      boxShadow: {
        subtle: "0 1px 2px 0 rgba(0, 0, 0, 0.04)",
        card: "0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px 0 rgba(0, 0, 0, 0.03)",
        elevated: "0 4px 6px -1px rgba(0, 0, 0, 0.06), 0 2px 4px -1px rgba(0, 0, 0, 0.03)",
      },
      borderRadius: {
        DEFAULT: "4px",
        sm: "4px",
        md: "6px",
        lg: "8px",
        xl: "8px",
      },
      keyframes: {
        "pulse-subtle": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.7" },
        },
      },
      animation: {
        "pulse-subtle": "pulse-subtle 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
    },
  },
  plugins: [],
};

export default config;
