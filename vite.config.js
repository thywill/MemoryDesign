import { defineConfig } from "vite";

export default defineConfig({
  // Relative URLs work both at localhost and at /MemoryDesign/ on GitHub Pages.
  base: "./",
  server: {
    port: 5173,
    strictPort: false,
  },
});
