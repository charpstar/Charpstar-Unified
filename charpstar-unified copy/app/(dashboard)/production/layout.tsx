"use client";

import React from "react";

export default function ProductionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className=" bg-background">
      {/* Page Content */}
      <main>{children}</main>
    </div>
  );
}
