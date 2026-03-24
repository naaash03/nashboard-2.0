import type { NextConfig } from "next";

const devPort = process.env.PORT ?? "3000";
const devLanHost = process.env.NASHBOARD_DEV_HOST?.trim();
const devOrigins: string[] = [
  `http://localhost:${devPort}`,
  `http://127.0.0.1:${devPort}`,
];
if (devLanHost) {
  devOrigins.push(`http://${devLanHost}:${devPort}`);
}

const nextConfig: NextConfig = {
  allowedDevOrigins: Array.from(new Set(devOrigins)),
};

export default nextConfig;
