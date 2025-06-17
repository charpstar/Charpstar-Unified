// src/app/[client]/demo/page.tsx
"use client";

import ClientDemoPage from "@/components/demo/ClientDemoPage";
import { useParams } from "next/navigation";
import { isValidClient } from "@/config/clientConfig";
import { notFound } from "next/navigation";

export default function DemoPage() {
  const params = useParams();
  const clientName = params.id as string; // Using 'id' instead of 'client'

  // Validate client
  if (!isValidClient(clientName)) {
    console.log("Demo: Invalid client name:", clientName);
    notFound();
  }

  console.log("Demo page mounting for client:", clientName);
  return <ClientDemoPage />;
}
