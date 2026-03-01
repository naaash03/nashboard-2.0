import type { NextConfig } from "next";

const devPort = process.env.PORT ?? "3000";
const devLanHost = process.env.NASHBOARD_DEV_HOST ?? "192.168.220.1";
const devOrigins = [
  `http://localhost:${devPort}`,
  `http://${devLanHost}:${devPort}`,
  `http://127.0.0.1:${devPort}`,
];

const nextConfig: NextConfig = {
  allowedDevOrigins: Array.from(new Set(devOrigins)),
};

export default nextConfig;
