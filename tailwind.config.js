/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        forensic: {
          bg: '#0E1117',
          card: '#161B22',
          border: '#30363D',
          text: {
            primary: '#F0F6FC',
            secondary: '#8B949E',
          },
          verified: '#3DDC84',
          inaccurate: '#F2A93B',
          false: '#E5484D',
          pending: '#8B949E',
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      animation: {
        'stamp-in': 'stampIn 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards',
      },
      keyframes: {
        stampIn: {
          '0%': { opacity: '0', transform: 'scale(2) rotate(15deg)' },
          '100%': { opacity: '1', transform: 'scale(1) rotate(-2deg)' },
        }
      }
    },
  },
  plugins: [],
}
