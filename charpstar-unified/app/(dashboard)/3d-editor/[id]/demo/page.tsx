// src/app/[client]/demo/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { fetchClientConfig } from "@/config/clientConfig";
import {
  ClientDemoPage,
  SimpleClientViewerScript,
} from "@/components/3d-editor";
import { useUser } from "@/contexts/useUser";
import { DemoPageSkeleton } from "@/components/ui/skeletons";
import { useIsMobile } from "@/hooks/use-mobile";
import { useRouter } from "next/navigation";

export default function DemoPage() {
  const router = useRouter();
  const params = useParams();
  const clientName = params?.id as string;
  const user = useUser();
  const isMobile = useIsMobile();

  const [isLoading, setIsLoading] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const [shouldLoadScript, setShouldLoadScript] = useState(false);
  const [hasAccess, setHasAccess] = useState(true);

  // Access control check - redirect if user doesn't have client_config
  useEffect(() => {
    if (
      user &&
      (!user.metadata?.client_config ||
        user.metadata.client_config.trim() === "")
    ) {
      setHasAccess(false);
      // Redirect to dashboard if user doesn't have access
      router.push("/dashboard");
    }
  }, [user]);

  useEffect(() => {
    const loadClientConfig = async () => {
      if (clientName && hasAccess) {
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
  }, [clientName, hasAccess]);

  if (!hasAccess) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="flex flex-col h-full bg-background">
        <DemoPageSkeleton isMobile={isMobile} />
      </div>
    );
  }

  if (!isReady) {
    return (
      <div className="flex flex-col h-full bg-background">
        <DemoPageSkeleton isMobile={isMobile} />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex-1 w-full h-full">
        <SimpleClientViewerScript shouldLoad={shouldLoadScript} />
        <ClientDemoPage />
      </div>
    </div>
  );
}
