import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import SessionProvider from "@/components/SessionProvider";
import AppShell from "@/components/AppShell";
import { loadCompanyPreferencesSettings } from "@/lib/company-preferences-store";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CRM/ERP System",
  description: "Custom CRM, ERP, and Planning Platform",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const companyPreferences = await loadCompanyPreferencesSettings()

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Script
          id="company-money-settings"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `window.__COMPANY_MONEY_SETTINGS__ = ${JSON.stringify(companyPreferences.moneySettings)};`,
          }}
        />
        <SessionProvider>
          <AppShell>{children}</AppShell>
        </SessionProvider>
      </body>
    </html>
  );
}
