import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AetherForge",
  description: "AI-powered learning app for building knowledge and skills."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
