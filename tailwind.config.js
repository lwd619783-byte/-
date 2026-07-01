/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#172033",
        panel: "#f6f7fb",
        line: "#d9dee8",
        signal: "#1f8a70",
        warning: "#c77700",
        risk: "#b23b3b",
        steel: "#4f6f8f"
      },
      boxShadow: {
        soft: "0 14px 34px rgba(23, 32, 51, 0.08)"
      }
    },
  },
  plugins: [],
};
