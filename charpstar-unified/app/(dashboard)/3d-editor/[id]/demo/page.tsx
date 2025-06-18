// src/app/[client]/demo/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { fetchClientConfig } from "@/config/clientConfig";
import ClientDemoPage from "@/components/demo/ClientDemoPage";
import SimpleClientViewerScript from "@/components/SimpleClientViewerScript";

export default function DemoPage() {
  const params = useParams();
  const clientName = params?.id as string;
  const [shouldLoadScript, setShouldLoadScript] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadClientConfig = async () => {
      if (clientName) {
        const clientConfig = await fetchClientConfig(clientName);
        if (clientConfig) {
          setShouldLoadScript(true);
        }
      }
      setIsLoading(false);
    };
    loadClientConfig();
  }, [clientName]);

  return (
    <div className="w-full h-full">
      <SimpleClientViewerScript shouldLoad={shouldLoadScript} />
      <ClientDemoPage />
    </div>
  );
}
