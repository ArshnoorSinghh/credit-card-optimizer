// Tailwind v4 runs as a PostCSS plugin — no tailwind.config.js needed.
// The design tokens live in app/globals.css under @theme (CSS-first config).
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
