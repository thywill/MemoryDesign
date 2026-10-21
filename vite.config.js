import { defineConfig } from "vite";

export default defineConfig({
  // Relative URLs work both at localhost and at /MemoryDesign/ on GitHub Pages.
  base: "./",
  // The wall is the only React code; esbuild's JSX transform is enough, no React plugin needed.
  esbuild: { jsx: "automatic" },
  server: { port: 5173, strictPort: false },
});
