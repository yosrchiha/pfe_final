import "./globals.css";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "./ThemeContext";
import AxiosSetup from "./AxiosSetup";   // ← ligne 1 : import

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

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
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider>
          <AxiosSetup />   {/* ← ligne 2 : composant */}
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
