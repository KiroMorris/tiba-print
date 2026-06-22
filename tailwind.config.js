/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // MyTurtle brand palette — dark emerald workspace with gilded-gold accents.
        ink: '#0E1A14', // deep emerald-tinted background (high contrast)
        panel: '#13261D', // panel surfaces
        panel2: '#1A4231', // raised surface = Deep Emerald (primary)
        edge: '#2C5443', // borders / dividers
        accent: '#C9A227', // Gilded Gold
        accent2: '#E0BE4A', // lighter gold for hovers
        emerald: '#1A4231', // primary brand
        muted: '#8FA89A', // sage muted text
      },
      fontFamily: {
        // Bagel Fat One = headings, Prompt = body. Loaded via next/font.
        heading: ['var(--font-bagel)', 'cursive'],
        body: ['var(--font-prompt)', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
