import type { Config } from "tailwindcss";

const withOpacityValue = (variableName: string) =>
  `hsl(var(${variableName}) / <alpha-value>)`;

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)"
        },
        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)"
        },
        primary: {
          DEFAULT: withOpacityValue("--primary"),
          foreground: "var(--primary-foreground)"
        },
        secondary: {
          DEFAULT: withOpacityValue("--secondary"),
          foreground: "var(--secondary-foreground)"
        },
        muted: {
          DEFAULT: withOpacityValue("--muted"),
          foreground: "var(--muted-foreground)"
        },
        accent: {
          DEFAULT: withOpacityValue("--accent"),
          foreground: "var(--accent-foreground)"
        },
        destructive: {
          DEFAULT: withOpacityValue("--destructive"),
          foreground: "var(--destructive-foreground)"
        },
        border: withOpacityValue("--border"),
        input: "var(--input)",
        ring: withOpacityValue("--ring"),
        chart: {
          1: withOpacityValue("--chart-1"),
          2: withOpacityValue("--chart-2"),
          3: withOpacityValue("--chart-3"),
          4: withOpacityValue("--chart-4"),
          5: withOpacityValue("--chart-5")
        },
        sidebar: {
          DEFAULT: withOpacityValue("--sidebar"),
          foreground: "var(--sidebar-foreground)",
          primary: withOpacityValue("--sidebar-primary"),
          "primary-foreground": "var(--sidebar-primary-foreground)",
          accent: withOpacityValue("--sidebar-accent"),
          "accent-foreground": "var(--sidebar-accent-foreground)",
          border: withOpacityValue("--sidebar-border"),
          ring: withOpacityValue("--sidebar-ring")
        }
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)"
      }
    }
  },
  plugins: []
};

export default config;
