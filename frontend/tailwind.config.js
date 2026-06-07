/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f2fcf5',
          100: '#e2f7e7',
          200: '#c5eed2',
          300: '#97deac',
          400: '#60c680',
          500: '#3ba95d',
          600: '#2c8a48',
          700: '#256e3c',
          800: '#205832',
          900: '#1b482a',
          950: '#0c2815',
        }
      }
    },
  },
  plugins: [],
}
