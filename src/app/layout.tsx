import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Safari Boys — Secure Compound Sourcing",
  description: "Browse, order, and track deliveries with our secure closed-wallet system, crypto payments, and 24/7 Telegram bot access.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
