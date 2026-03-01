/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/renderer/index.html',
    './src/renderer/src/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      animation: {
        'countdown-pop': 'countdownPop 0.3s ease-out',
      },
      keyframes: {
        countdownPop: {
          '0%': { transform: 'scale(1.4)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
