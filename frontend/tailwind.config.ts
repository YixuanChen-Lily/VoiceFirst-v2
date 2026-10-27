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
        // Forest and birch: the app's own palette (see the home page).
        forest: { DEFAULT: "#2F6B4F", dark: "#234F3B", tint: "#E4EDE7" },
        ochre: { DEFAULT: "#C98A2B", tint: "#F6EAD3", text: "#7A4F0F" },
        birch: "#FAF7F2",
        ink: { DEFAULT: "#2B2A28", muted: "#5F5A54" },
        line: "#E6E0D6",
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
      fontFamily: {
        readable: ["var(--font-readable)", "system-ui", "sans-serif"]
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
