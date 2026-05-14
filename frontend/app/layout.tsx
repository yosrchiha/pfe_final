import "./globals.css";
import type { Metadata } from "next";
import { ThemeProvider } from "./ThemeContext";
import AxiosSetup from "./AxiosSetup";

export const metadata: Metadata = {
  title: "AuditPlatform",
  description: "Plateforme intelligente d'audit GitLab",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className="antialiased">
        <ThemeProvider>
          <AxiosSetup />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}