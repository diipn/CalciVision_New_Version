/* O content indica à extensão do VS Code quais são os ficheiros que vão ter autocomplete do Tailwind */
/* @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src//*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {},
    },
    plugins: [],
}