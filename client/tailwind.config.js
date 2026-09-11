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
        glass: '0 8px 32px 0 rgba(31, 38, 135, 0.07)',
      },
      backgroundImage: {
        'app-gradient': 'linear-gradient(135deg, #E8F5E9 0%, #F1F8F2 100%)',
      },
    },
  },
  plugins: [],
};
