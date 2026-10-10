/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      fontSize: {
        caption: ['12px', { lineHeight: '1.4' }],
        xs: ['14px', { lineHeight: '1.5' }],
        sm: ['14px', { lineHeight: '1.5' }],
        base: ['16px', { lineHeight: '1.6' }],
        md: ['18px', { lineHeight: '1.6' }],
        lg: ['20px', { lineHeight: '1.6' }],
        xl: ['24px', { lineHeight: '1.5' }],
        '2xl': ['32px', { lineHeight: '1.2' }],
      },
      spacing: {
        0.5: '4px',
        1: '8px',
        1.5: '12px',
        2: '16px',
        2.5: '20px',
        3: '24px',
        4: '32px',
        5: '40px',
      },
      colors: {
        eucalyptus: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#6ee7b7',
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
          800: '#065f46',
          900: '#064e3b',
        },
      },
    },
  },
  plugins: [],
}
