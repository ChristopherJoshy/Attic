import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "UNTANGLE // shared expense ledger",
  description:
    "AI-powered shared expense & IOU tracker with real-time updates. Built for roommates, trips, and friend groups.",
  keywords: ["expenses", "split", "IOU", "realtime", "AI", "Untangle"],
  authors: [{ name: "Untangle" }],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistMono.variable} antialiased min-h-screen flex flex-col scanlines crt-flicker`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
