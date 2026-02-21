import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

// 👇 AJOUTEZ CES LIGNES DANS VOS METADATA
export const metadata: Metadata = {
  title: "RavenTech Studio",
  description: "Portail Studio et Espace Mariés",
  manifest: "/manifest.json",
  themeColor: "#1c1917",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "RavenTech",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body className={inter.className}>{children}</body>
    </html>
  );
}