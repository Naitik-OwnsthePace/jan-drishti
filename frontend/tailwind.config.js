/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          900: '#0F172A',
          800: '#1E293B',
          700: '#334155',
        },
        surface: {
          workspace: '#F8FAFC',
          card: '#FFFFFF',
          border: '#E2E8F0',
        },
        civic: {
          escalated: '#D97706',
          breached: '#DC2626',
          resolved: '#059669',
          unverified: '#64748B',
        }
      },
      animation: {
        'pulse-fast': 'pulse 1.2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      }
    },
  },
  plugins: [],
}
