import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#faf8f5",
        ink: "#1c1a17",
        clay: "#8a6a52",
        sand: "#e8e0d4",
        mist: "#6b6560",
        accent: "#a8562f",
      },
      fontFamily: {
        serif: ["Georgia", "Iowan Old Style", "Palatino Linotype", "serif"],
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Inter",
          "sans-serif",
        ],
      },
      maxWidth: {
        editorial: "42rem",
      },
      boxShadow: {
        subtle: "0 1px 2px rgba(28, 26, 23, 0.06)",
        card: "0 1px 3px rgba(28, 26, 23, 0.08)",
      },
    },
  },
  plugins: [],
};

export default config;
