import { useEffect, useState } from "react";

const query = "(prefers-color-scheme: dark)";

// Light: "Saturday afternoon" daylight from the upper left. Dark: "after hours" under warm ceiling lamps.
const palettes = {
  light: { wall: "#f4f1ea", floor: "#e9e4da", overlay: 0.65, light: "rgba(255,248,232,0.75)" },
  dark: { wall: "#17140f", floor: "#120f0b", overlay: 0.75, light: "rgba(255,184,102,0.16)" },
};

const read = () => {
  const dark = matchMedia(query).matches;
  return {
    bg: getComputedStyle(document.documentElement).getPropertyValue("--bg").trim() || "#ffffff",
    dark,
    ...palettes[dark ? "dark" : "light"],
  };
};

// The page background from CSS (--bg) and the shop palette, kept in sync with the system light/dark setting.
export function useThemeBg() {
  const [theme, setTheme] = useState(read);
  useEffect(() => {
    const mq = matchMedia(query);
    const onChange = () => setTheme(read());
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return theme;
}
