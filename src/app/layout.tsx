import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import Script from "next/script";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "RIDA SUPREME SYSTEM",
  description: "Ride-hailing platform - Client, Driver, Admin & Marketplace",
};

import NotificationListener from "@/components/NotificationListener";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="dark" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-rida-dark text-foreground min-h-screen`}
      >
        <NotificationListener />
        {children}
        <Toaster position="top-center" richColors theme="dark" />
        <Script id="chunk-error-handler" strategy="afterInteractive">
          {`if(typeof window!=='undefined'){window.addEventListener('error',function(e){if(e.message&&e.message.includes('ChunkLoadError')){window.location.reload();}});window.addEventListener('unhandledrejection',function(e){if(e.reason&&e.reason.message&&e.reason.message.includes('ChunkLoadError')){window.location.reload();}});}`}
        </Script>
      </body>
    </html>
  );
}
