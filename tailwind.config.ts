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
        // Restrained AI Accent - used ONLY inside AI elements
        ai: {
          50: "#F5F3FF",
          100: "#EDE9FE",
          200: "#DDD6FE",
          300: "#C4B5FD",
          400: "#A78BFA",
          500: "#8B5CF6",
          600: "#6D28D9",
          700: "#5B21B6",
          800: "#4C1D95",
          900: "#3B0764",
          surface: "#FAF8FF",
          border: "#E0D7FE",
          text: "#5239A0",
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
          DEFAULT: "#171717", // Near Black
          muted: "#6B6870",   // Muted
          soft: "#8E8A94",
          faint: "#B8B5BE",
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
        subtle: "0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px 0 rgba(0, 0, 0, 0.03)",
        card: "0 2px 6px -1px rgba(122, 31, 43, 0.06), 0 1px 4px -1px rgba(0, 0, 0, 0.04)",
        elevated: "0 10px 25px -5px rgba(84, 19, 29, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04)",
      },
      borderRadius: {
        DEFAULT: "6px",
        md: "8px",
        lg: "10px",
        xl: "12px",
      },
      keyframes: {
        "pulse-subtle": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.6" },
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
