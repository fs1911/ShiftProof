import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Minimal, credible B2B palette. Slate-based neutrals + a single brand accent.
        brand: {
          50: "#eef4ff",
          100: "#d9e6ff",
          500: "#2f6bff",
          600: "#1f57e6",
          700: "#1a46b8",
        },
      },
    },
  },
  plugins: [],
};

export default config;
