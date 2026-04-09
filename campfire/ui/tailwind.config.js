/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    fontFamily: {
      sans: ["Rubik", "Inter", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
      mono: ["Source Code Pro", "Roboto Mono", "Courier New", "monospace"],
    },
  },
  plugins: [],
};
