/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans:    ['DM Sans', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        display: ['Syne', '-apple-system', 'sans-serif'],
      },
      colors: {
        // Paleta "brand" usada en Admin, Mis Productos y componentes de formulario
        brand: {
          50:  '#f8f9ff',
          100: '#f0f2f9',
          200: '#e2e5f0',
          300: '#c8cde0',
          400: '#8b95b8',
          500: '#5c6490',
          600: '#3d4466',
          700: '#2a2f4a',
          800: '#1c2133',
          900: '#111827',
        },
      },
    },
  },
  plugins: [],
}
