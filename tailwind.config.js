/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#020617",
        bg2: "#08111F",
        ink: "#E5E7EB",
        panel: "#0F172A",
        panel2: "#111C2E",
        card: "rgba(15, 23, 42, 0.82)",
        line: "#1E293B",
        borderGlow: "rgba(34, 211, 238, 0.35)",
        signal: "#22D3EE",
        warning: "#F59E0B",
        risk: "#EF4444",
        steel: "#94A3B8",
        terminalBlue: "#3B82F6",
        terminalViolet: "#8B5CF6",
        rise: "#EF4444",
        fall: "#22C55E"
      },
      boxShadow: {
        soft: "0 20px 70px rgba(0, 0, 0, 0.34)",
        glow: "0 0 0 1px rgba(34, 211, 238, 0.18), 0 16px 54px rgba(34, 211, 238, 0.09)"
      }
    },
  },
  plugins: [],
};
