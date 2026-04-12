import { createContext, useContext, useEffect, useState } from "react";

const ThemeContext = createContext({ isDark: false, toggle: () => {} });

export function ThemeProvider({ children }) {
  const [isDark] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", "light");
    try { localStorage.setItem("metrobus_theme", "light"); } catch { /* ignore */ }
  }, [isDark]);

  const toggle = () => {};

  return (
    <ThemeContext.Provider value={{ isDark, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
