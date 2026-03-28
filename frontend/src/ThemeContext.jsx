import { createContext, useContext, useEffect, useState } from "react";

const ThemeContext = createContext({ isDark: true, toggle: () => {} });

export function ThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(() => {
    try {
      const saved = localStorage.getItem("metrobus_theme");
      if (saved) return saved === "dark";
    } catch { /* ignore */ }
    return true; // default dark
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");
    try { localStorage.setItem("metrobus_theme", isDark ? "dark" : "light"); } catch { /* ignore */ }
  }, [isDark]);

  const toggle = () => setIsDark(v => !v);

  return (
    <ThemeContext.Provider value={{ isDark, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
