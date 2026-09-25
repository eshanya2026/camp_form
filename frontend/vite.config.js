import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 1005,
    proxy: {
      "/api": "http://localhost:2005",
    },
  },
});
