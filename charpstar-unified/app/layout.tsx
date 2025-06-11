import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import "./globals.css";
import { Providers } from "@/app/providers";
import { SWRConfig } from "swr";
import { localStorageProvider } from "@/lib/swrLocalStorageProvider";
import { SidebarProvider } from "@/components/ui/sidebar";
import { SharedLayout } from "./shared-layout";
import { DateRangeProvider } from "@/contexts/DateRangeContext";

const montserrat = Montserrat({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: {
    default: "CharpstAR Platform - Dashboard",
    template: "CharpstAR Platform - %s",
  },
  description: "CharpstAR Platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${montserrat.variable}  antialiased`}>
        <div style={{ fontSize: "var(--user-font-size, 16px)" }}>
          <SWRConfig value={{ provider: localStorageProvider }}>
            <SidebarProvider
              style={
                {
                  "--sidebar-width": "calc(var(--spacing) * 72)",
                  "--header-height": "calc(var(--spacing) * 12)",
                } as React.CSSProperties
              }
            >
              <Providers>
                <DateRangeProvider>
                  <SharedLayout>{children}</SharedLayout>
                </DateRangeProvider>
              </Providers>
            </SidebarProvider>
          </SWRConfig>
        </div>
      </body>
    </html>
  );
}
