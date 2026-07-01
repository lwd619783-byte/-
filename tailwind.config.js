/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#020617",
        bg2: "#08111F",
        bg3: "#0B1120",
        surface: "#0F172A",
        surface2: "#111827",
        surface3: "#162033",
        card: "rgba(15, 23, 42, 0.86)",
        cardHover: "rgba(30, 41, 59, 0.92)",
        border: "#1E293B",
        borderSoft: "rgba(148, 163, 184, 0.18)",
        borderGlow: "rgba(34, 211, 238, 0.35)",
        text: "#E5E7EB",
        textStrong: "#F8FAFC",
        textMuted: "#94A3B8",
        textWeak: "#64748B",
        cyan: "#22D3EE",
        blue: "#3B82F6",
        violet: "#8B5CF6",
        amber: "#F59E0B",
        rise: "#EF4444",
        fall: "#22C55E",
        neutral: "#94A3B8",
        danger: "#EF4444",
        success: "#22C55E",
        warning: "#F59E0B",
        ink: "#E5E7EB",
        panel: "#0F172A",
        panel2: "#111C2E",
        line: "#1E293B",
        signal: "#22D3EE",
        risk: "#EF4444",
        steel: "#94A3B8",
        terminalBlue: "#3B82F6",
        terminalViolet: "#8B5CF6"
      },
      boxShadow: {
        soft: "0 20px 70px rgba(0, 0, 0, 0.34)",
        glow: "0 0 0 1px rgba(34, 211, 238, 0.18), 0 16px 54px rgba(34, 211, 238, 0.09)"
      }
    },
  },
  plugins: [],
};
