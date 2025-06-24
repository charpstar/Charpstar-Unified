import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import "./globals.css";
import { Providers } from "@/app/providers";
import { SWRConfig } from "swr";
import { localStorageProvider } from "@/lib/swrLocalStorageProvider";
import { SidebarProvider } from "@/components/navigation";
import { SharedLayout } from "./shared-layout";
import { DateRangeProvider } from "@/contexts/DateRangeContext";

// Root layout font configuration
const montserrat = Montserrat({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

// Global metadata for SEO and browser tab titles
export const metadata: Metadata = {
  title: {
    default: "CharpstAR Platform - Dashboard",
    template: "CharpstAR Platform - %s",
  },
  description: "CharpstAR Platform",
};

/**
 * Root Layout Component
 *
 * This is the top-level layout that wraps the entire application.
 * Responsibilities:
 * - Sets up global providers (SWR, Sidebar, Theme, DateRange)
 * - Configures fonts and CSS variables
 * - Handles HTML structure and metadata
 * - Provides global state management context
 *
 * This layout is applied to ALL pages in the application.
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${montserrat.variable}  antialiased`}>
        <div style={{ fontSize: "var(--user-font-size, 16px)" }}>
          {/* SWR configuration for data fetching with localStorage persistence */}
          <SWRConfig value={{ provider: localStorageProvider }}>
            {/* Sidebar provider for managing sidebar state across the app */}
            <SidebarProvider
              style={
                {
                  "--sidebar-width": "calc(var(--spacing) * 50.4)",
                  "--header-height": "calc(var(--spacing) * 12)",
                } as React.CSSProperties
              }
            >
              {/* Theme and other global providers */}
              <Providers>
                {/* Date range context for analytics and date-based features */}
                <DateRangeProvider>
                  {/* Shared layout handles the actual page structure */}
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
