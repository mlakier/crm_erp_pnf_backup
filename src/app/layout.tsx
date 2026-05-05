import type { Metadata } from "next";
import "./globals.css";
import AppShell from "@/components/AppShell";
import { loadCompanyPreferencesSettings } from "@/lib/company-preferences-store";
import { loadCompanyPageLogo } from "@/lib/company-page-logo";

export const metadata: Metadata = {
  title: "CRM/ERP System",
  description: "Custom CRM, ERP, and Planning Platform",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [companyPreferences, companyPageLogo] = await Promise.all([
    loadCompanyPreferencesSettings(),
    loadCompanyPageLogo(),
  ])

  return (
    <html
      lang="en"
      className="h-full antialiased"
      data-company-money-settings={encodeURIComponent(JSON.stringify(companyPreferences.moneySettings))}
    >
      <body className="min-h-full flex flex-col">
        <AppShell companyLogoUrl={companyPageLogo?.url ?? null}>{children}</AppShell>
      </body>
    </html>
  );
}
