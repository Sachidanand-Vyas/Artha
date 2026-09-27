import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/layout/AppShell";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Artha — AI-Powered Wealth Intelligence",
  description:
    "Artha is an AI-driven financial literacy and decision-support platform that explains why — not just what to do. Technical and fundamental analysis on real market data, with transparent BUY/HOLD/SELL reasoning. Not financial advice.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {/* Apply the persisted theme before first paint (no flash). Dark is the default. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              'try{var t=localStorage.getItem("artha-theme");if(t==="light"||t==="dark"){document.documentElement.dataset.theme=t}}catch(e){}',
          }}
        />
      </head>
      <body className="min-h-full">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
