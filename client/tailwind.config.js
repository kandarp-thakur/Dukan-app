/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#2E7D32',
        accent: '#4CAF50',
        mint: '#E8F5E9',
        sage: '#F1F8F2',
      },
      boxShadow: {
        glass: '0 8px 32px 0 rgba(31, 38, 135, 0.10), inset 0 1px 0 0 rgba(255, 255, 255, 0.65)',
        'glass-lg': '0 12px 40px 0 rgba(31, 38, 135, 0.12), inset 0 1px 0 0 rgba(255, 255, 255, 0.65)',
        'btn-glow': '0 4px 16px 0 rgba(46, 125, 50, 0.30)',
      },
      backgroundImage: {
        'app-gradient': 'linear-gradient(135deg, #E8F5E9 0%, #F1F8F2 100%)',
      },
    },
  },
  plugins: [],
};
