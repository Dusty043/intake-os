import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        sidebar: "#0f172a",
        canvas: "#f8f9ff",
        primary: "#3525cd",
        "primary-dark": "#4f46e5",
        "primary-light": "#e2dfff",
        "surface-subtle": "#eff4ff",
        "surface-container": "#e5eeff",
        brand: {
          border: "#c7c4d8",
          text: "#0b1c30",
          muted: "#464555",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
        mono: ["ui-monospace", "Consolas", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
