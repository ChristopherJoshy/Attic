/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./**/*.{html,js}"
  ],
  theme: {
    extend: {
      colors: {
        'orix-beige': '#FBF6F3',
        'orix-charcoal': '#2D2D2D',
        'orix-accent': '#A7E3CC',
        'orix-accent-dark': '#8DD4B8',
      },
      fontFamily: {
        'serif': ['Playfair Display', 'Georgia', 'serif'],
        'sans': ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'pill': '0 1px 2px rgba(0, 0, 0, 0.06), 0 2px 4px rgba(0, 0, 0, 0.08), 0 4px 8px rgba(0, 0, 0, 0.1)',
        'pill-hover': '0 2px 4px rgba(0, 0, 0, 0.08), 0 4px 8px rgba(0, 0, 0, 0.1), 0 8px 16px rgba(0, 0, 0, 0.12)',
      }
    },
  },
  plugins: [],
}
