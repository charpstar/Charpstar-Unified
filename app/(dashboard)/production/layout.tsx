"use client";

import React from "react";

export default function ProductionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      {/* Page Content */}
      <main>{children}</main>
    </div>
  );
}
