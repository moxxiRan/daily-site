import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "日报精选",
  description: "每天 10 分钟，跟上进展",
  keywords: ["AI", "游戏", "日报", "科技", "新闻"],
  authors: [{ name: "Daily Site" }],
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#020618" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <Script id="theme-init" strategy="beforeInteractive">
          {`(function(){try{
            var t=localStorage.getItem('theme')||
              (window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');
            document.documentElement.classList.toggle('dark', t==='dark');
            document.documentElement.style.colorScheme=t;
          }catch(e){}})();`}
        </Script>
        {children}
      </body>
    </html>
  );
}
