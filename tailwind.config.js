/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  // dark mode via clase .light (invertido: default = dark, .light = light)
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        // Syne para headings, DM Sans para body
        sans:    ['DM Sans', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        display: ['Syne', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
