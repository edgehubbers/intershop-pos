// tailwind.config.cjs
module.exports = {
  darkMode: "class",
  content: ["./index.html", "./app/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter","ui-sans-serif","system-ui","-apple-system","Segoe UI","Roboto","Helvetica Neue","Arial","Apple Color Emoji","Segoe UI Emoji"],
      },
      borderRadius: { xl: "12px" },
    },
  },
  plugins: [require("@tailwindcss/forms")], // si lo instalaste
};
