// src/app/[client]/demo/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { getClientConfig } from "@/config/clientConfig";
import ClientDemoPage from "@/components/demo/ClientDemoPage";
import SimpleClientViewerScript from "@/components/SimpleClientViewerScript";

export default function DemoPage() {
  const params = useParams();
  const clientName = params?.id as string;
  const [shouldLoadScript, setShouldLoadScript] = useState(false);

  useEffect(() => {
    if (clientName) {
      const clientConfig = getClientConfig(clientName);
      if (clientConfig) {
        setShouldLoadScript(true);
      }
    }
  }, [clientName]);

  return (
    <div className="w-full h-full">
      {shouldLoadScript && <SimpleClientViewerScript />}
      <ClientDemoPage />
    </div>
  );
}
