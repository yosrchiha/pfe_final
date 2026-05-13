// frontend/next.config.ts
// Nécessaire pour le build Docker standalone (output: "standalone")
import type { NextConfig } from "next";
 
const nextConfig: NextConfig = {
  output: "standalone",   // ← requis pour le Dockerfile multi-stage
};
 
export default nextConfig;
