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
      // Preserve fixed v3 line heights when child font-size is overridden.
      fontSize: {"xs": ["0.75rem", {"lineHeight": "1rem"}], "sm": ["0.875rem", {"lineHeight": "1.25rem"}], "base": ["1rem", {"lineHeight": "1.5rem"}], "lg": ["1.125rem", {"lineHeight": "1.75rem"}], "xl": ["1.25rem", {"lineHeight": "1.75rem"}], "2xl": ["1.5rem", {"lineHeight": "2rem"}], "3xl": ["1.875rem", {"lineHeight": "2.25rem"}], "4xl": ["2.25rem", {"lineHeight": "2.5rem"}], "5xl": ["3rem", {"lineHeight": "1"}], "6xl": ["3.75rem", {"lineHeight": "1"}], "7xl": ["4.5rem", {"lineHeight": "1"}], "8xl": ["6rem", {"lineHeight": "1"}], "9xl": ["8rem", {"lineHeight": "1"}]},
      borderRadius: { lg: "10px", md: "6px", sm: "2px" },
      blur: { sm: "4px" },
      backdropBlur: { sm: "4px" },
      boxShadow: {
        sm: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
        soft: "var(--ui-shadow)",
        glow: "var(--ui-glow)",
      }
    },
  },
  plugins: [],
};
