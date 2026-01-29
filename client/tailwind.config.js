/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}', './public/index.html'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#2563eb',
          hover: '#1d4ed8',
          light: '#3b82f6',
        },
        sidebar: {
          DEFAULT: '#1e293b',
          hover: '#334155',
          accent: '#38bdf8',
        },
      },
    },
  },
  plugins: [],
}
