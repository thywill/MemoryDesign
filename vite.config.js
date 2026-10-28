import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import { resolve } from "node:path";
import { defineConfig } from "vite";

// A local certificate that includes this machine's addresses, so a phone can use motion sensors.
function devHttps() {
  try {
    const dir = resolve(".cert");
    fs.mkdirSync(dir, { recursive: true });
    const ips = new Set(["127.0.0.1"]);
    for (const list of Object.values(os.networkInterfaces())) {
      for (const net of list || []) {
        if (net.family === "IPv4" && !net.internal) ips.add(net.address);
      }
    }
    const stamp = [...ips].sort().join(",");
    const stampFile = resolve(dir, "ips.txt");
    const keyFile = resolve(dir, "key.pem");
    const certFile = resolve(dir, "cert.pem");
    const current = fs.existsSync(stampFile) && fs.existsSync(keyFile) && fs.existsSync(certFile) && fs.readFileSync(stampFile, "utf8") === stamp;
    if (!current) {
      execFileSync("openssl", [
        "req", "-x509", "-newkey", "rsa:2048", "-sha256", "-days", "30", "-nodes",
        "-keyout", keyFile, "-out", certFile,
        "-subj", "/CN=lowlamp",
        "-addext", `subjectAltName=${["DNS:localhost", ...[...ips].map((ip) => `IP:${ip}`)].join(",")}`,
      ], { stdio: "ignore" });
      fs.writeFileSync(stampFile, stamp);
    }
    return { key: fs.readFileSync(keyFile), cert: fs.readFileSync(certFile) };
  } catch {
    return null;
  }
}

const https = devHttps();

export default defineConfig({
  // Vercel serves the site at the domain root. GitHub Pages serves it under /MemoryDesign/.
  base: process.env.VERCEL ? "/" : "/MemoryDesign/",
  esbuild: { jsx: "automatic" },
  server: { port: 5173, strictPort: false, ...(https ? { https } : {}) },
  build: {
    rollupOptions: {
      input: {
        main: resolve("index.html"),
        controller: resolve("controller.html"),
      },
    },
  },
});
