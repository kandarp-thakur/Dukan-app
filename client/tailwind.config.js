/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#C2410C',
        accent: '#F97316',
        peach: '#FFEDD5',
        cream: '#FFF7ED',
      },
      boxShadow: {
        glass: '0 8px 32px 0 rgba(31, 38, 135, 0.10), inset 0 1px 0 0 rgba(255, 255, 255, 0.65)',
        'glass-lg': '0 12px 40px 0 rgba(31, 38, 135, 0.12), inset 0 1px 0 0 rgba(255, 255, 255, 0.65)',
        'btn-glow': '0 4px 16px 0 rgba(194, 65, 12, 0.30)',
      },
      backgroundImage: {
        'app-gradient': 'linear-gradient(135deg, #FFEDD5 0%, #FFF7ED 100%)',
      },
    },
  },
  plugins: [],
};
