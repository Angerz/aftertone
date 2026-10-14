import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, "..", "AFTERTONE_");
  const target = `http://127.0.0.1:${env.AFTERTONE_API_PORT ?? "8017"}`;
  return {
    plugins: [react()],
    server: { host: "127.0.0.1", proxy: { "/api": target, "/media": target } },
  };
});
