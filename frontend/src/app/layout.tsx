import type { Metadata, Viewport } from "next";
import { Source_Serif_4, Inter, IBM_Plex_Mono } from "next/font/google";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";
import { Suspense } from "react";
import OfflineManager from "@/components/OfflineManager";
import AnalyticsTracker from "@/components/AnalyticsTracker";

const serif = Source_Serif_4({ 
  subsets: ["latin"],
  variable: "--font-source-serif",
  display: "swap"
});

const sans = Inter({ 
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap"
});

const mono = IBM_Plex_Mono({ 
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
  display: "swap"
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.FRONTEND_URL || "https://smartcampingau.com"),
  title: {
    default: "Camp Smart Australia | Printed-Grade Australian Camping Field Guide",
    template: "%s | Camp Smart Australia",
  },
  description: "Campground finder for Australian campers. Live fire danger ratings, Total Fire Ban status, and printable trip packs for Australian campers.",
  keywords: [
    "camp smart australia",
    "australia camping",
    "campgrounds nsw",
    "live fire danger rating",
    "dog friendly camping sydney",
    "plan b camping",
    "free camping australia",
    "bush camping",
    "offline trip pack"
  ],
  authors: [{ name: "Camp Smart Australia" }],
  creator: "Camp Smart Australia",
  publisher: "Camp Smart Australia",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Camp Smart Australia"
  },
  openGraph: {
    type: "website",
    locale: "en_AU",
    url: "https://smartcampingau.com",
    siteName: "Camp Smart Australia",
    title: "Camp Smart Australia | Condition-Aware Camping Field Guide",
    description: "Know before you pitch: live fire danger ratings, honest condition briefs, and automatic Plan B alternatives.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Camp Smart Australia",
    description: "Live Australian fire rules, weather alerts, and vetted campground guide.",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": "https://smartcampingau.com/#website",
      "url": "https://smartcampingau.com",
      "name": "Camp Smart Australia",
      "description": "Campground finder for Australian campers with live fire rules and honest condition briefs.",
      "inLanguage": "en-AU"
    },
    {
      "@type": "WebApplication",
      "@id": "https://smartcampingau.com/#app",
      "name": "Camp Smart Australia",
      "url": "https://smartcampingau.com",
      "applicationCategory": "TravelApplication",
      "operatingSystem": "All",
      "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "AUD"
      }
    }
  ]
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
    <html lang="en" className={`${serif.variable} ${sans.variable} ${mono.variable}`}>
      <body className="font-sans antialiased bg-paper text-ink selection:bg-eucalypt selection:text-white">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {children}
        <OfflineManager />
        <Suspense fallback={null}>
          <AnalyticsTracker />
        </Suspense>
      </body>
    </html>
  );
}
