/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          bg: "#020617",
          card: "#0F172A",
          accent: "#22D3EE",
          text: "#F8FAFC",
          muted: "#94A3B8",
        },
      },
    },
  },
  plugins: [],
};
