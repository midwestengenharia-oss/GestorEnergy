/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                primary: "#00A3E0", // Azul Energisa
                dark: "#0f172a",
                card: "#1e293b"
            }
        },
    },
    plugins: [],
}