import type { Metadata, Viewport } from "next";
import { Outfit } from "next/font/google";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";
import OfflineManager from "@/components/OfflineManager";

const outfit = Outfit({ 
  subsets: ["latin"],
  variable: "--font-outfit"
});

export const metadata: Metadata = {
  title: "Camp Smart Australia | Answer-First Trip Finder",
  description: "Curated, rigorous, condition-aware Trip Cards with live weather and fire rules.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "CampSmart AU"
  }
};

export const viewport: Viewport = {
  themeColor: "#051c14",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${outfit.variable} font-sans antialiased`}>
        {children}
        <OfflineManager />
      </body>
    </html>
  );
}
