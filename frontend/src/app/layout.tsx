import type { Metadata, Viewport } from "next";
import { Outfit } from "next/font/google";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";
import { Suspense } from "react";
import OfflineManager from "@/components/OfflineManager";
import AnalyticsTracker from "@/components/AnalyticsTracker";

const outfit = Outfit({ 
  subsets: ["latin"],
  variable: "--font-outfit"
});

export const metadata: Metadata = {
  title: "Camp Smart Australia | Condition-Aware Field Guide",
  description: "Curated, rigorous, condition-aware Australian camping trip finder with live fire rules and microclimate forecasting.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "CampSmart AU"
  }
};

export const viewport: Viewport = {
  themeColor: "#2F5D50",
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
    <html lang="en">
      <body className={`${outfit.variable} font-sans antialiased bg-[#F6F1E7] text-[#1E2A24]`}>
        {children}
        <OfflineManager />
        <Suspense fallback={null}>
          <AnalyticsTracker />
        </Suspense>
      </body>
    </html>
  );
}
