// src/components/SimpleClientViewerScript.tsx
"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
import { getClientConfig } from "@/config/clientConfig";

const SimpleClientViewerScript = () => {
  const params = useParams();
  const clientName = params?.id as string;
  console.log(
    "[SimpleClientViewerScript] Loading script for client:",
    clientName
  );

  useEffect(() => {
    const loadScript = async () => {
      try {
        // Get the appropriate script for this client
        const scriptSrc = getClientConfig(clientName).scriptPath;
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
  }, [clientName]);

  return null;
};

export default SimpleClientViewerScript;
