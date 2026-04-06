import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  // El dark mode se maneja mediante la clase .light en <html>
  // porque el default ES dark y usamos CSS variables
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans:    ['DM Sans', 'sans-serif'],
        display: ['Syne', 'sans-serif'],
      },
      colors: {
        // Estos colores mapean a las CSS variables para poder usarlos en Tailwind
        accent:   'var(--accent)',
        surface:  'var(--bg-surface)',
        base:     'var(--bg-base)',
        card:     'var(--bg-card)',
        border:   'var(--border)',
        primary:  'var(--text-primary)',
        secondary:'var(--text-secondary)',
        muted:    'var(--text-muted)',
        success:  'var(--success)',
        warning:  'var(--warning)',
        danger:   'var(--danger)',
      },
      borderRadius: {
        '2xl': '16px',
        '3xl': '20px',
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        glow: 'var(--shadow-glow)',
      },
    },
  },
  plugins: [],
}

export default config
