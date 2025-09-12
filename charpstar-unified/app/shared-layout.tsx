"use client";

import { AppSidebar } from "@/components/navigation";
import { usePathname } from "next/navigation";
import { SiteHeader } from "@/components/navigation";

/**
 * Shared Layout Component
 *
 * This component handles the actual page structure and layout logic.
 * Responsibilities:
 * - Determines when to show/hide sidebar based on current route
 * - Manages the main content area layout
 * - Handles responsive design and spacing
 * - Provides consistent layout structure across different pages
 *
 * This layout is used by the root layout to structure the actual page content.
 * It's a client component because it needs to access the current pathname.
 */
export function SharedLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // List all routes where you DON'T want the sidebar (and bg-muted)
  // These are typically authentication pages or standalone pages
  const noSidebarRoutes = ["/auth", "/reset-password"];
  const hideSidebar = noSidebarRoutes.some((route) =>
    pathname.startsWith(route)
  );

  // Conditional class for the main content wrapper
  // Applies different styling based on whether sidebar is present
  const mainContentClass = [
    "flex-1 flex flex-col min-h-screen w-full overflow-x-hidden p-4 bg-gradient-to-b from-[#606d64] to-[#b69f84]  ",
    !hideSidebar && "bg-gradient-to-b from-[#606d64] to-[#b69f84] ",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="flex min-h-screen w-full bg-background rounded-lg">
      {/* Sidebar - only shown on pages that need navigation */}
      {!hideSidebar && <AppSidebar variant="inset" />}

      {/* Main content area - column layout */}
      <div className={mainContentClass}>
        {/* Site header - only shown when sidebar is present */}
        {!hideSidebar && <SiteHeader />}

        {/* Main content container with scrolling and proper sizing */}

        <div className="flex-1 overflow-y-auto rounded-b-lg justify-center items-center h-full max-h-[calc(100vh-80px)]  relative">
          {/* Animated Space Background */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#b69f84] to-[#606d64]">
            {/* Stars Layer 1 - Large stars */}
            <div className="absolute inset-0 opacity-60">
              {Array.from({ length: 50 }).map((_, i) => (
                <div
                  key={`star1-${i}`}
                  className="absolute w-1 h-1 bg-white rounded-full animate-pulse"
                  style={{
                    left: `${Math.random() * 100}%`,
                    top: `${Math.random() * 100}%`,
                    animationDelay: `${Math.random() * 3}s`,
                    animationDuration: `${2 + Math.random() * 2}s`,
                  }}
                />
              ))}
            </div>

            {/* Stars Layer 2 - Medium stars */}
            <div className="absolute inset-0 opacity-40">
              {Array.from({ length: 100 }).map((_, i) => (
                <div
                  key={`star2-${i}`}
                  className="absolute w-0.5 h-0.5 bg-blue-200 rounded-full"
                  style={{
                    left: `${Math.random() * 100}%`,
                    top: `${Math.random() * 100}%`,
                    animation: `twinkle ${3 + Math.random() * 4}s ease-in-out infinite`,
                    animationDelay: `${Math.random() * 5}s`,
                  }}
                />
              ))}
            </div>

            {/* Stars Layer 3 - Small stars */}
            <div className="absolute inset-0 opacity-30">
              {Array.from({ length: 200 }).map((_, i) => (
                <div
                  key={`star3-${i}`}
                  className="absolute w-px h-px bg-white rounded-full"
                  style={{
                    left: `${Math.random() * 100}%`,
                    top: `${Math.random() * 100}%`,
                    animation: `twinkle ${2 + Math.random() * 3}s ease-in-out infinite`,
                    animationDelay: `${Math.random() * 4}s`,
                  }}
                />
              ))}
            </div>

            {/* Moving particles */}
            <div className="absolute inset-0 overflow-hidden">
              {Array.from({ length: 20 }).map((_, i) => (
                <div
                  key={`particle-${i}`}
                  className="absolute w-1 h-1 bg-cyan-300 rounded-full opacity-70"
                  style={{
                    left: `${Math.random() * 100}%`,
                    top: `${Math.random() * 100}%`,
                    animation: `float ${10 + Math.random() * 20}s linear infinite`,
                    animationDelay: `${Math.random() * 10}s`,
                  }}
                />
              ))}
            </div>
          </div>

          <style jsx>{`
            @keyframes twinkle {
              0%,
              100% {
                opacity: 0.3;
                transform: scale(1);
              }
              50% {
                opacity: 1;
                transform: scale(1.2);
              }
            }

            @keyframes float {
              0% {
                transform: translateY(100vh) translateX(0px);
                opacity: 0;
              }
              10% {
                opacity: 1;
              }
              90% {
                opacity: 1;
              }
              100% {
                transform: translateY(-100px)
                  translateX(${Math.random() * 200 - 100}px);
                opacity: 0;
              }
            }
          `}</style>
          {children}
        </div>
      </div>
    </div>
  );
}
