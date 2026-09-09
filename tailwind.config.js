const color = (name) => `rgb(var(--color-${name}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: color("bg"), bg2: color("panel"), bg3: color("raised"),
        surface: color("panel"), surface2: color("raised"), surface3: color("raised"),
        card: color("panel"), cardHover: color("raised"),
        border: color("border"), borderSoft: color("border"), borderGlow: color("accent"),
        control: color("control"),
        text: color("text"), textStrong: color("text"), textMuted: color("muted"), textWeak: color("weak"),
        accent: color("accent"), secondary: color("secondary"),
        onaccent: color("onaccent"), selected: color("selected"),
        cyan: color("accent"), blue: color("info"), violet: color("secondary"), amber: color("warning"),
        up: color("up"), down: color("down"), rise: color("up"), fall: color("down"),
        neutral: color("muted"), danger: color("error"), success: color("down"), warning: color("warning"),
        ink: color("text"), panel: color("panel"), panel2: color("raised"), line: color("border"),
        signal: color("accent"), risk: color("error"), steel: color("muted"),
        terminalBlue: color("info"), terminalViolet: color("secondary"),
      },
      borderRadius: { lg: "10px", md: "6px" },
      boxShadow: {
        soft: "var(--ui-shadow)",
        glow: "var(--ui-glow)",
      }
    },
  },
  plugins: [],
};
