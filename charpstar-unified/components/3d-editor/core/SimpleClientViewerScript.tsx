// src/components/SimpleClientViewerScript.tsx
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { fetchClientConfig } from "@/config/clientConfig";

interface SimpleClientViewerScriptProps {
  shouldLoad: boolean;
}

const SimpleClientViewerScript = ({
  shouldLoad,
}: SimpleClientViewerScriptProps) => {
  const params = useParams();
  const clientName = params?.id as string;
  const [scriptSrc, setScriptSrc] = useState<string | null>(null);

  console.log(
    "[SimpleClientViewerScript] Loading script for client:",
    clientName
  );

  // First fetch the client config
  useEffect(() => {
    if (!shouldLoad) return;
    const getConfig = async () => {
      if (clientName) {
        const config = await fetchClientConfig(clientName);
        console.log("[SimpleClientViewerScript] fetched config:", config);
        setScriptSrc(config.scriptPath);
      }
    };
    getConfig();
  }, [clientName, shouldLoad]);

  // Then load the script once we have the scriptSrc
  useEffect(() => {
    if (!shouldLoad) return;
    const loadScript = async () => {
      if (!scriptSrc) return;

      try {
        console.log("[SimpleClientViewerScript] Loading script:", scriptSrc);

        // Check if script is already loaded
        if (document.querySelector(`script[src="${scriptSrc}"]`)) {
          console.log("[SimpleClientViewerScript] Script already loaded");
          return;
        }

        // Create and load the script
        const script = document.createElement("script");
        script.src = scriptSrc;
        script.type = "module";

        await new Promise((resolve, reject) => {
          script.onload = () => {
            console.log(
              "[SimpleClientViewerScript] Script loaded successfully"
            );
            resolve(true);
          };
          script.onerror = (error) => {
            console.error(
              "[SimpleClientViewerScript] Error loading script:",
              error
            );
            reject(error);
          };
          document.head.appendChild(script);
        });
      } catch (error) {
        console.error(
          "[SimpleClientViewerScript] Failed to load script:",
          error
        );
      }
    };

    loadScript();
  }, [scriptSrc, shouldLoad]);

  return null;
};

export default SimpleClientViewerScript;
