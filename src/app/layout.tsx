import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Oddity",
  description: "A daily multi-mode random roll scoring game. Roll, collect badges, chase EP.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-background text-foreground min-h-screen">{children}</body>
    </html>
  );
}
