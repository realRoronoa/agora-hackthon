/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        nw: {
          bg: "#0B0D10",
          card: "#12151A",
          surface: "#181C24",
          border: "#22262E",
          subtle: "#2A303C",
          text: "#E2E8F0",
          muted: "#8590A6",
          emerald: "#10B981",
          amber: "#F59E0B",
          crimson: "#EF4444",
        },
      },
      fontFamily: {
        mono: [
          "JetBrains Mono",
          "Fira Code",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          "monospace",
        ],
      },
    },
  },
  plugins: [],
}
