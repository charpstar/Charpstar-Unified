import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import "./globals.css";
import { Providers } from "@/app/providers";
import { SWRConfig } from "swr";
import { localStorageProvider } from "@/lib/swrLocalStorageProvider";
import { SidebarProvider } from "@/components/navigation";
import { SharedLayout } from "./shared-layout";
import { DateRangeProvider } from "@/contexts/DateRangeContext";
import { Editor3DProvider } from "@/contexts/Editor3DContext";
import { Suspense } from "react";
import { Analytics } from "@vercel/analytics/react";
import Script from "next/script";

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
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Preload model-viewer script globally for instant 3D model rendering */}
        <Script
          src="https://unpkg.com/@google/model-viewer/dist/model-viewer.min.js"
          type="module"
          strategy="beforeInteractive"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                // Global error handler to prevent app crashes
                window.addEventListener('error', function(event) {
                  console.error('Global error caught:', event.error);
                  // Prevent the default error handling that might cause page reload
                  event.preventDefault();
                  return false;
                });

                // Global unhandled promise rejection handler
                window.addEventListener('unhandledrejection', function(event) {
                  console.error('Unhandled promise rejection:', event.reason);
                  // Prevent the default error handling that might cause page reload
                  event.preventDefault();
                  return false;
                });

                function restoreEditorTheme() {
                  try {
                    const isDark = document.documentElement.classList.contains('dark');
                    const key = isDark ? 'editor-theme-dark' : 'editor-theme-light';
                    const savedTheme = localStorage.getItem(key) || 'shadcn';
                    
                    const themeColors = {
                      'supabase-green': {
                        light: { 
                          '--primary': '#3ECF8E', 
                          '--primary-foreground': '#fff', 
                          '--background': '#fff',
                          '--primary-hue': '153',
                          '--primary-sat': '60%',
                          '--primary-light': '45%'
                        },
                        dark: { 
                          '--primary': '#3ECF8E', 
                          '--primary-foreground': '#1e293b', 
                          '--background': '#18181b',
                          '--primary-hue': '153',
                          '--primary-sat': '60%',
                          '--primary-light': '45%'
                        }
                      },
                      'lavender-purple': {
                        light: { 
                          '--primary': '#A855F7', 
                          '--primary-foreground': '#fff', 
                          '--background': '#fff',
                          '--primary-hue': '271',
                          '--primary-sat': '90%',
                          '--primary-light': '65%'
                        },
                        dark: { 
                          '--primary': '#C084FC', 
                          '--primary-foreground': '#1e293b', 
                          '--background': '#18181b',
                          '--primary-hue': '271',
                          '--primary-sat': '90%',
                          '--primary-light': '75%'
                        }
                      },
                      'fire-orange': {
                        light: { 
                          '--primary': '#F97316', 
                          '--primary-foreground': '#fff', 
                          '--background': '#fff',
                          '--primary-hue': '25',
                          '--primary-sat': '95%',
                          '--primary-light': '55%'
                        },
                        dark: { 
                          '--primary': '#FB923C', 
                          '--primary-foreground': '#1e293b', 
                          '--background': '#18181b',
                          '--primary-hue': '25',
                          '--primary-sat': '95%',
                          '--primary-light': '65%'
                        }
                      },
                      'windows-blue': {
                        light: { 
                          '--primary': '#2563eb', 
                          '--primary-foreground': '#fff', 
                          '--background': '#fff',
                          '--primary-hue': '217',
                          '--primary-sat': '91%',
                          '--primary-light': '53%'
                        },
                        dark: { 
                          '--primary': '#60a5fa', 
                          '--primary-foreground': '#1e293b', 
                          '--background': '#18181b',
                          '--primary-hue': '217',
                          '--primary-sat': '91%',
                          '--primary-light': '70%'
                        }
                      },
                      'shadcn': {
                        light: { 
                          '--primary': '#18181b', 
                          '--primary-foreground': '#fff', 
                          '--background': '#fff',
                          '--primary-hue': '0',
                          '--primary-sat': '0%',
                          '--primary-light': '10%'
                        },
                        dark: { 
                          '--primary': '#fff', 
                          '--primary-foreground': '#18181b', 
                          '--background': '#18181b',
                          '--primary-hue': '0',
                          '--primary-sat': '0%',
                          '--primary-light': '100%'
                        }
                      }
                    };
                    
                    const selected = themeColors[savedTheme];
                    if (selected) {
                      const colors = isDark ? selected.dark : selected.light;
                      for (const [k, v] of Object.entries(colors)) {
                        document.documentElement.style.setProperty(k, v);
                      }
                    }
                  } catch (e) {
                    console.warn('Failed to restore editor theme:', e);
                  }
                }

                // Restore theme on page load
                restoreEditorTheme();

                // Listen for theme changes
                const observer = new MutationObserver(function(mutations) {
                  mutations.forEach(function(mutation) {
                    if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                      restoreEditorTheme();
                    }
                  });
                });

                observer.observe(document.documentElement, {
                  attributes: true,
                  attributeFilter: ['class']
                });
              })();
            `,
          }}
        />
      </head>
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
                <Analytics />
                {/* Date range context for analytics and date-based features */}
                <DateRangeProvider>
                  <Editor3DProvider>
                    {/* Shared layout handles the actual page structure */}
                    <Suspense
                      fallback={
                        <div className="flex items-center justify-center min-h-screen"></div>
                      }
                    >
                      <SharedLayout>{children}</SharedLayout>
                    </Suspense>
                  </Editor3DProvider>
                </DateRangeProvider>
              </Providers>
            </SidebarProvider>
          </SWRConfig>
        </div>
      </body>
    </html>
  );
}
