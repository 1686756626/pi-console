import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

type Theme = "light" | "dark" | "warm" | "cool" | "forest";

const themes: Record<Theme, Record<string, string>> = {
  light: {
    "--ht-bg": "#faf9f7",
    "--ht-surface": "#ffffff",
    "--ht-fg": "#1a1a1a",
    "--ht-fg-secondary": "#6b6570",
    "--ht-border": "#e8e4df",
    "--ht-accent": "#6b5b73",
    "--ht-accent-muted": "rgba(107,91,115,0.10)",
    "--ht-accent-subtle": "rgba(107,91,115,0.06)",
    "--ht-on-accent": "#ffffff",
    "--ht-success": "#16a34a",
    "--ht-success-bg": "rgba(22,163,74,0.10)",
    "--ht-warning": "#b45309",
    "--ht-warning-bg": "rgba(180,83,9,0.10)",
    "--ht-error": "#dc2626",
    "--ht-error-bg": "rgba(220,38,38,0.10)",
    "--ht-info": "#2563eb",
    "--ht-info-bg": "rgba(37,99,235,0.10)",
    "--ht-overlay": "rgba(0,0,0,0.3)",
    "--ht-shadow": "0 1px 3px rgba(0,0,0,0.04)",
    "--ht-shadow-hover": "0 4px 12px rgba(0,0,0,0.08)",
    "--ht-radius-sm": "6px",
    "--ht-radius-md": "8px",
    "--ht-radius-lg": "12px",
  },
  dark: {
    "--ht-bg": "#141417",
    "--ht-surface": "#1e1e24",
    "--ht-fg": "#e4e0da",
    "--ht-fg-secondary": "#8a8690",
    "--ht-border": "#2e2e36",
    "--ht-accent": "#b09ec0",
    "--ht-accent-muted": "rgba(176,158,192,0.14)",
    "--ht-accent-subtle": "rgba(176,158,192,0.08)",
    "--ht-on-accent": "#1a1a1e",
    "--ht-success": "#4ade80",
    "--ht-success-bg": "rgba(74,222,128,0.12)",
    "--ht-warning": "#fbbf24",
    "--ht-warning-bg": "rgba(251,191,36,0.12)",
    "--ht-error": "#f87171",
    "--ht-error-bg": "rgba(248,113,113,0.12)",
    "--ht-info": "#60a5fa",
    "--ht-info-bg": "rgba(96,165,250,0.12)",
    "--ht-overlay": "rgba(0,0,0,0.6)",
    "--ht-shadow": "0 1px 3px rgba(0,0,0,0.2)",
    "--ht-shadow-hover": "0 4px 12px rgba(0,0,0,0.3)",
    "--ht-radius-sm": "6px",
    "--ht-radius-md": "8px",
    "--ht-radius-lg": "12px",
  },
  warm: {
    "--ht-bg": "#faf5ee",
    "--ht-surface": "#fff9f2",
    "--ht-fg": "#3a2510",
    "--ht-fg-secondary": "#8a7460",
    "--ht-border": "#e6d8c6",
    "--ht-accent": "#b56e1a",
    "--ht-accent-muted": "rgba(181,110,26,0.12)",
    "--ht-accent-subtle": "rgba(181,110,26,0.07)",
    "--ht-on-accent": "#ffffff",
    "--ht-success": "#15803d",
    "--ht-success-bg": "rgba(21,128,61,0.10)",
    "--ht-warning": "#a16207",
    "--ht-warning-bg": "rgba(161,98,7,0.10)",
    "--ht-error": "#b91c1c",
    "--ht-error-bg": "rgba(185,28,28,0.10)",
    "--ht-info": "#1d4ed8",
    "--ht-info-bg": "rgba(29,78,216,0.10)",
    "--ht-overlay": "rgba(40,20,0,0.3)",
    "--ht-shadow": "0 1px 3px rgba(80,40,0,0.06)",
    "--ht-shadow-hover": "0 4px 12px rgba(80,40,0,0.10)",
    "--ht-radius-sm": "6px",
    "--ht-radius-md": "8px",
    "--ht-radius-lg": "12px",
  },
  cool: {
    "--ht-bg": "#f2f5fa",
    "--ht-surface": "#f8faff",
    "--ht-fg": "#152035",
    "--ht-fg-secondary": "#5a6d85",
    "--ht-border": "#c8d4e2",
    "--ht-accent": "#2b6cb0",
    "--ht-accent-muted": "rgba(43,108,176,0.12)",
    "--ht-accent-subtle": "rgba(43,108,176,0.07)",
    "--ht-on-accent": "#ffffff",
    "--ht-success": "#15803d",
    "--ht-success-bg": "rgba(21,128,61,0.10)",
    "--ht-warning": "#a16207",
    "--ht-warning-bg": "rgba(161,98,7,0.10)",
    "--ht-error": "#b91c1c",
    "--ht-error-bg": "rgba(185,28,28,0.10)",
    "--ht-info": "#1e40af",
    "--ht-info-bg": "rgba(30,64,175,0.10)",
    "--ht-overlay": "rgba(0,10,30,0.3)",
    "--ht-shadow": "0 1px 3px rgba(0,20,60,0.06)",
    "--ht-shadow-hover": "0 4px 12px rgba(0,20,60,0.10)",
    "--ht-radius-sm": "6px",
    "--ht-radius-md": "8px",
    "--ht-radius-lg": "12px",
  },
  forest: {
    "--ht-bg": "#f0f7f0",
    "--ht-surface": "#f6faf6",
    "--ht-fg": "#1a3a1a",
    "--ht-fg-secondary": "#5a7a5a",
    "--ht-border": "#c2dbc2",
    "--ht-accent": "#2d7d2d",
    "--ht-accent-muted": "rgba(45,125,45,0.12)",
    "--ht-accent-subtle": "rgba(45,125,45,0.07)",
    "--ht-on-accent": "#ffffff",
    "--ht-success": "#15803d",
    "--ht-success-bg": "rgba(21,128,61,0.10)",
    "--ht-warning": "#a16207",
    "--ht-warning-bg": "rgba(161,98,7,0.10)",
    "--ht-error": "#b91c1c",
    "--ht-error-bg": "rgba(185,28,28,0.10)",
    "--ht-info": "#1d4ed8",
    "--ht-info-bg": "rgba(29,78,216,0.10)",
    "--ht-overlay": "rgba(0,20,0,0.3)",
    "--ht-shadow": "0 1px 3px rgba(0,40,0,0.06)",
    "--ht-shadow-hover": "0 4px 12px rgba(0,40,0,0.10)",
    "--ht-radius-sm": "6px",
    "--ht-radius-md": "8px",
    "--ht-radius-lg": "12px",
  },
};

const themeLabels: Record<Theme, string> = {
  light: "浅色",
  dark: "深色",
  warm: "暖色",
  cool: "冷色",
  forest: "森林",
};

interface ThemeContextValue {
  theme: Theme;
  setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "light",
  setTheme: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem("pi-theme");
    return (saved as Theme) || "light";
  });

  useEffect(() => {
    const vars = themes[theme];
    Object.entries(vars).forEach(([key, value]) => {
      document.documentElement.style.setProperty(key, value);
    });
    localStorage.setItem("pi-theme", theme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  const keys = Object.keys(themeLabels) as Theme[];

  return (
    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
      {keys.map((key) => (
        <button
          key={key}
          onClick={() => setTheme(key)}
          title={themeLabels[key]}
          style={{
            width: 20,
            height: 20,
            borderRadius: "50%",
            border: theme === key ? "2px solid var(--ht-accent)" : "1px solid var(--ht-border)",
            background: themes[key]["--ht-accent"],
            cursor: "pointer",
            transition: "all 0.15s ease",
            transform: theme === key ? "scale(1.15)" : "scale(1)",
          }}
        />
      ))}
    </div>
  );
}
