// src/app/[client]/demo/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { fetchClientConfig } from "@/config/clientConfig";
import ClientDemoPage from "@/components/demo/ClientDemoPage";
import SimpleClientViewerScript from "@/components/SimpleClientViewerScript";
import { Header } from "@/components/Header";

export default function DemoPage() {
  const params = useParams();
  const clientName = params?.id as string;
  const [shouldLoadScript, setShouldLoadScript] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const loadClientConfig = async () => {
      if (clientName) {
        const clientConfig = await fetchClientConfig(clientName);
        if (clientConfig) {
          setShouldLoadScript(true);

          // Add a delay to ensure script loading and initialization
          setTimeout(() => {
            setIsReady(true);
            setIsLoading(false);
          }, 500);
        } else {
          setIsLoading(false);
        }
      } else {
        setIsLoading(false);
      }
    };
    loadClientConfig();
  }, [clientName]);

  if (isLoading) {
    return (
      <div className="flex flex-col h-full bg-background">
        <Header />
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">
              Loading client configuration...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!isReady) {
    return (
      <div className="flex flex-col h-full bg-background">
        <Header />
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Initializing 3D viewer...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background">
      <Header />
      <div className="flex-1 w-full max-h-[calc(100vh-48px)]">
        <SimpleClientViewerScript shouldLoad={shouldLoadScript} />
        <ClientDemoPage />
      </div>
    </div>
  );
}
