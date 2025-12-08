import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { nodePolyfills } from "vite-plugin-node-polyfills";

export default defineConfig(({ command }) => {
  return {
    plugins: [react(), nodePolyfills()],
    base: "./",
    server: {
      port: 3000,
    },
    build: {
      outDir: "build", // CRA's default build output
      rollupOptions: {
        input: {
          main: "./index.html",
        },
      },
    },
    define: {
      global: "window",
      ENABLE_ANALYTICS: true,
      BUILD_TARGET: JSON.stringify("web"),
      BUILD_VERSION: JSON.stringify(process.env.npm_package_version || "0.0.1"),
      BUILD_DATE: JSON.stringify(new Date().toISOString()),
    },
    ...(command === "serve" && {
      root: ".",
      server: {
        ...this?.server,
        port: 3000,
        open: "/index.html",
      },
    }),
  };
});
