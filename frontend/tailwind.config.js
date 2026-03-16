/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          50: "#f0f7ff",
          100: "#e0effe",
          200: "#bae0fd",
          300: "#7ccbfb",
          400: "#36b2f7",
          500: "#0c97e8",
          600: "#0078c6",
          700: "#015fa1",
          800: "#065185",
          900: "#0b446e",
        },
        accent: {
          50: "#fef3f2",
          100: "#fee4e2",
          200: "#fececa",
          300: "#fcaaa4",
          400: "#f87a6f",
          500: "#ef5242",
          600: "#dd3524",
          700: "#ba291a",
          800: "#9a2519",
          900: "#80251c",
        },
      },
    },
  },
  plugins: [],
};
