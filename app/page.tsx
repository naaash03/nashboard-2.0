import DashboardPage from "@/components/dashboard/DashboardPage";
import { isAuthConfigured, isDbConfigured } from "@/lib/config/env";

export default function Home() {
  const dbConfigured = isDbConfigured();
  const authConfigured = isAuthConfigured() && dbConfigured;
  return <DashboardPage authConfigured={authConfigured} dbConfigured={dbConfigured} />;
}

