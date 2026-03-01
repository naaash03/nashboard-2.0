import type { Metadata } from "next";
import "./globals.css";
import AppProviders from "@/components/AppProviders";
import { isAuthConfigured, isDbConfigured } from "@/lib/config/env";

export const metadata: Metadata = {
  title: "NashBoard",
  description: "Sports dashboards with ESPN-backed widgets",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const authConfigured = isAuthConfigured() && isDbConfigured();

  return (
    <html lang="en" className="dark">
      <body className="antialiased">
        <AppProviders authConfigured={authConfigured}>{children}</AppProviders>
      </body>
    </html>
  );
}

