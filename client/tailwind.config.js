/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        paralegal: {
          navy: '#0f172a',
          surface: '#f8fafc',
          border: '#e2e8f0',
          yellow: '#fef08a',
          yellowBorder: '#ca8a04',
          red: '#fecaca',
          redBorder: '#dc2626'
        }
      }
    },
  },
  plugins: [],
}
