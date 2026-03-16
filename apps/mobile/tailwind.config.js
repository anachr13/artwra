/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Warm, painterly palette
        canvas: {
          950: '#0f0a05',
          900: '#1a1207',
          800: '#2a1e0e',
          700: '#3d2c14',
        },
        ochre: {
          400: '#d4922a',
          500: '#b87820',
          600: '#9a6018',
        },
        sienna: {
          400: '#c0614a',
          500: '#a04835',
          600: '#823225',
        },
        cobalt: {
          400: '#4a6fa5',
          500: '#3a5a8a',
          600: '#2a4570',
        },
        cream: {
          50: '#fdf8f0',
          100: '#f5edd8',
          200: '#e8d5b0',
        },
      },
    },
  },
};
