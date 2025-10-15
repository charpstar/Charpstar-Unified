#!/usr/bin/env tsx

import { createClient } from "@supabase/supabase-js";
import fetch from "node-fetch";
import * as fs from "fs";

// Configuration
const SUPABASE_URL = "https://tpamckewerybqzhhhqqp.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRwYW1ja2V3ZXJ5YnF6aGhocXFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc2NDUwMzgsImV4cCI6MjA2MzIyMTAzOH0.qt8Xazht0rEmhyWzU2iBtAK3iYZ3GLHujRH5KQhPVS8";
const CLIENT_NAME = "Synsam";

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("Missing Supabase environment variables");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

interface Asset {
  id: string;
  product_name: string;
  glb_link: string;
  client: string;
}

interface CheckResult {
  asset: Asset;
  status: "success" | "error" | "timeout";
  statusCode?: number;
  error?: string;
  responseTime?: number;
}

async function checkGlbLink(asset: Asset): Promise<CheckResult> {
  const startTime = Date.now();

  try {
    // Reduced logging for faster processing - only log every 10th item
    if (Math.random() < 0.1) {
      console.log(`Checking: ${asset.product_name} (${asset.id})`);
    }

    const response = await fetch(asset.glb_link, {
      method: "HEAD",
      timeout: 5000, // Reduced to 5 second timeout for faster processing
      headers: {
        "User-Agent": "GLB-Link-Checker/1.0",
      },
    });

    const responseTime = Date.now() - startTime;

    if (response.ok) {
      return {
        asset,
        status: "success",
        statusCode: response.status,
        responseTime,
      };
    } else {
      return {
        asset,
        status: "error",
        statusCode: response.status,
        error: `HTTP ${response.status}: ${response.statusText}`,
        responseTime,
      };
    }
  } catch (error: any) {
    const responseTime = Date.now() - startTime;

    if (error.code === "ECONNABORTED" || error.message.includes("timeout")) {
      return {
        asset,
        status: "timeout",
        error: "Request timeout",
        responseTime,
      };
    }

    return {
      asset,
      status: "error",
      error: error.message,
      responseTime,
    };
  }
}

async function main() {
  console.log(`🔍 Checking GLB links for client: ${CLIENT_NAME}`);
  console.log("=".repeat(50));

  try {
    // Fetch all assets for Synsam client
    const { data: assets, error } = await supabase
      .from("assets")
      .select("id, product_name, glb_link, client")
      .eq("client", CLIENT_NAME)
      .not("glb_link", "is", null)
      .not("glb_link", "eq", "");

    if (error) {
      console.error("Error fetching assets:", error);
      process.exit(1);
    }

    if (!assets || assets.length === 0) {
      console.log(`No assets found for client: ${CLIENT_NAME}`);
      return;
    }

    console.log(`Found ${assets.length} assets with GLB links`);
    console.log("");

    const results: CheckResult[] = [];
    const batchSize = 20; // Increased batch size for faster processing

    // Process assets in batches
    for (let i = 0; i < assets.length; i += batchSize) {
      const batch = assets.slice(i, i + batchSize);
      const batchPromises = batch.map((asset) => checkGlbLink(asset));

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Show progress
      const processed = Math.min(i + batchSize, assets.length);
      console.log(
        `Progress: ${processed}/${assets.length} assets checked (${Math.round((processed / assets.length) * 100)}%)`
      );

      // Reduced delay between batches for faster processing
      if (i + batchSize < assets.length) {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }

    // Analyze results
    const successful = results.filter((r) => r.status === "success");
    const errors = results.filter((r) => r.status === "error");
    const timeouts = results.filter((r) => r.status === "timeout");

    console.log("📊 SUMMARY");
    console.log("=".repeat(50));
    console.log(`Total assets checked: ${results.length}`);
    console.log(`✅ Successful: ${successful.length}`);
    console.log(`❌ Errors: ${errors.length}`);
    console.log(`⏱️  Timeouts: ${timeouts.length}`);
    console.log("");

    // Show successful links (optional - comment out if too verbose)
    if (successful.length > 0) {
      console.log("✅ SUCCESSFUL LINKS:");
      successful.forEach((result) => {
        console.log(
          `  • ${result.asset.product_name} (${result.statusCode}) - ${result.responseTime}ms`
        );
      });
      console.log("");
    }

    // Show error details
    if (errors.length > 0) {
      console.log("❌ ERRORS:");
      errors.forEach((result) => {
        console.log(
          `  • ${result.asset.product_name} (ID: ${result.asset.id})`
        );
        console.log(`    URL: ${result.asset.glb_link}`);
        console.log(`    Error: ${result.error}`);
        if (result.statusCode) {
          console.log(`    Status Code: ${result.statusCode}`);
        }
        console.log("");
      });
    }

    // Show timeout details
    if (timeouts.length > 0) {
      console.log("⏱️  TIMEOUTS:");
      timeouts.forEach((result) => {
        console.log(
          `  • ${result.asset.product_name} (ID: ${result.asset.id})`
        );
        console.log(`    URL: ${result.asset.glb_link}`);
        console.log(`    Error: ${result.error}`);
        console.log("");
      });
    }

    // Generate CSV report
    const csvContent = [
      "Product Name,Asset ID,GLB Link,Status,Status Code,Error,Response Time (ms)",
      ...results.map((result) =>
        [
          `"${result.asset.product_name}"`,
          result.asset.id,
          `"${result.asset.glb_link}"`,
          result.status,
          result.statusCode || "",
          `"${result.error || ""}"`,
          result.responseTime || "",
        ].join(",")
      ),
    ].join("\n");

    const filename = `glb-link-check-${CLIENT_NAME.toLowerCase()}-${new Date().toISOString().split("T")[0]}.csv`;
    fs.writeFileSync(filename, csvContent);
    console.log(`📄 Detailed report saved to: ${filename}`);

    // Exit with error code if there are issues
    if (errors.length > 0 || timeouts.length > 0) {
      console.log(
        `\n⚠️  Found ${errors.length + timeouts.length} problematic links`
      );
      process.exit(1);
    } else {
      console.log("\n🎉 All GLB links are accessible!");
      process.exit(0);
    }
  } catch (error) {
    console.error("Script error:", error);
    process.exit(1);
  }
}

// Run the script
main().catch(console.error);
