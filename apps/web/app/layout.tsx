import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CRM ERP PNF",
  description: "Custom CRM ERP and Planning platform scaffold"
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
