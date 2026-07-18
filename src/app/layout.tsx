import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SAFARIBOYZ — Private Marketplace",
  description: "Browse, order, and track deliveries with SAFARIBOYZ.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
