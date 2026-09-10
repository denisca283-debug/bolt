/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['"Playfair Display"', 'Georgia', 'serif'],
      },
      colors: {
        // Main background #121515
        base: {
          950: '#0E1110',
          900: '#121515',
          850: '#151918',
          800: '#181C1C',
        },
        // Cards / surfaces
        surface: {
          700: '#1C2120',
          600: '#202525',
          500: '#292F2E',
          400: '#323937',
        },
        // Borders
        line: {
          DEFAULT: '#343B39',
          soft: '#2A302E',
          strong: '#3E4643',
        },
        // Text
        txt: {
          primary: '#F2F3F1',
          secondary: '#A7AEAB',
          muted: '#737B78',
        },
        // FilmVerse emerald
        emerald: {
          50: '#0C1F1A',
          100: '#103028',
          200: '#16372F',
          300: '#1B4A3E',
          400: '#0D8F70',
          500: '#0D8F70',
          600: '#11A780',
          700: '#14C094',
        },
        // Status
        danger: {
          600: '#C04848',
          700: '#D45757',
          200: '#3A1C1C',
        },
        warn: {
          600: '#C49A3A',
          700: '#D4AB4E',
          200: '#3A321C',
        },
        // Legacy aliases for backward compatibility with existing components
        paper: {
          50: '#181C1C',
          100: '#121515',
          200: '#202525',
          300: '#292F2E',
        },
        stone: {
          400: '#737B78',
          500: '#A7AEAB',
          600: '#343B39',
          700: '#292F2E',
          800: '#202525',
          900: '#181C1C',
          950: '#121515',
        },
        fern: {
          50: '#0C1F1A',
          100: '#103028',
          200: '#16372F',
          300: '#1B4A3E',
          400: '#0D8F70',
          500: '#0D8F70',
          600: '#11A780',
          700: '#14C094',
        },
        ink: {
          900: '#F2F3F1',
          800: '#E0E2DF',
          700: '#A7AEAB',
          600: '#737B78',
          500: '#5A615E',
          400: '#3E4643',
          300: '#343B39',
        },
      },
      boxShadow: {
        'soft': '0 1px 2px rgba(0,0,0,0.2), 0 4px 16px -8px rgba(0,0,0,0.3)',
        'soft-lg': '0 2px 4px rgba(0,0,0,0.2), 0 12px 40px -12px rgba(0,0,0,0.4)',
        'card': '0 1px 3px rgba(0,0,0,0.25), 0 8px 24px -10px rgba(0,0,0,0.35)',
        'portrait': '0 4px 24px -6px rgba(0,0,0,0.5)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'slide-in-left': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(0)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.5s cubic-bezier(0.22,1,0.36,1) both',
        'fade-in': 'fade-in 0.4s ease-out both',
        'scale-in': 'scale-in 0.3s cubic-bezier(0.22,1,0.36,1) both',
        'slide-in-left': 'slide-in-left 0.3s cubic-bezier(0.22,1,0.36,1) both',
      },
    },
  },
  plugins: [],
};
