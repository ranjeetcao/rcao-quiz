/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './src/**/*.{js,jsx,ts,tsx}',
    '../../packages/sdk/src/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: '#0b1220',
          50: '#f5f7fb',
          100: '#e7ecf4',
          200: '#cdd6e4',
          300: '#a3b1c8',
          400: '#7286a6',
          500: '#52668a',
          600: '#3f5070',
          700: '#33415a',
          800: '#21293c',
          900: '#0b1220',
        },
      },
    },
  },
  plugins: [],
};
