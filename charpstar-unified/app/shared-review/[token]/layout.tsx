"use client";

/**
 * Public layout for shared review pages
 * No authentication required - access is controlled by token
 */
export default function SharedReviewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="w-full bg-background ">
      {/* Minimal header for branding */}
      <div className="border-b border-border bg-background">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold text-foreground">
                CharpstAR Review
              </h1>
            </div>
          </div>
        </div>
      </div>
      {/* Main content */}
      <div className="container mx-auto px-4 py-6 ">{children}</div>
    </div>
  );
}
