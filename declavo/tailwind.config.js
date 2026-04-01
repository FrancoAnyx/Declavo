/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
        mono: ['DM Mono', 'monospace'],
      },
      colors: {
        brand: {
          50:  '#F7F6F3',
          100: '#F0EFE9',
          200: '#E2E0D8',
          300: '#D0CEC4',
          400: '#9B9990',
          500: '#6B6960',
          900: '#1A1916',
        },
      },
    },
  },
  plugins: [],
}
