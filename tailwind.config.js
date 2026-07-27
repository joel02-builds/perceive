import typography from '@tailwindcss/typography'

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        perceive: {
          bg: '#F7F5F0',
          card: '#FFFFFF',
          primary: '#3D6B8E',
          accent: '#5BA08A',
          amber: '#E8A838',
          text: '#1A1A2A',
          muted: '#6B7280',
          border: '#E5E0D8',
          darkbg: '#111827',
          darkcard: '#1F2937',
        },
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        serif: ['Fraunces', 'serif'],
      },
    },
  },
  plugins: [
    typography,
  ],
}
