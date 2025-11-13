//@ts-nocheck
/**
 * Asset Link Checker Script
 *
 * This script checks all GLB links in the assets table by making HEAD requests
 * and categorizes responses by status codes (403, 404, 204, no content, good)
 *
 * Run with: npx tsx scripts/check-asset-links.ts
 */

import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

// Hardcoded environment variables - replace with your actual values
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface Asset {
  id: string;
  product_name: string;
  glb_link: string;
  client: string;
  category: string;
  subcategory: string;
}

interface LinkCheckResult {
  asset: Asset;
  status: "success" | "error" | "timeout";
  httpStatus?: number;
  error?: string;
  responseTime?: number;
}

interface StatusCategories {
  forbidden: LinkCheckResult[]; // 403
  notFound: LinkCheckResult[]; // 404
  noContent: LinkCheckResult[]; // 204
  successful: LinkCheckResult[]; // 200, 301, 302, etc.
  errors: LinkCheckResult[]; // Network errors, timeouts
  noContentType: LinkCheckResult[]; // No content-type header
}

const TIMEOUT = 10000; // 15 seconds
const BATCH_SIZE = 10; // Process 10 requests concurrently

async function makeHeadRequest(url: string): Promise<{
  status: "success" | "error" | "timeout";
  httpStatus?: number;
  error?: string;
  responseTime?: number;
}> {
  const startTime = Date.now();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT);

    const response = await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; AssetLinkChecker/1.0)",
      },
    });

    clearTimeout(timeoutId);
    const responseTime = Date.now() - startTime;

    return {
      status: "success",
      httpStatus: response.status,
      responseTime,
    };
  } catch (error: any) {
    const responseTime = Date.now() - startTime;

    if (error.name === "AbortError") {
      return {
        status: "timeout",
        error: "Request timeout",
        responseTime,
      };
    }

    return {
      status: "error",
      error: error.message || "Unknown error",
      responseTime,
    };
  }
}

async function checkAssetLinks(): Promise<void> {
  console.log("🔍 Checking all asset GLB links...");
  console.log("==================================================");

  try {
    // Fetch all assets with GLB links
    const { data: assets, error } = await supabase
      .from("assets")
      .select("id, product_name, glb_link, client, category, subcategory")
      .not("glb_link", "is", null)
      .neq("glb_link", "");

    if (error) {
      console.error("❌ Error fetching assets:", error);
      return;
    }

    if (!assets || assets.length === 0) {
      console.log("ℹ️  No assets with GLB links found");
      return;
    }

    console.log(`Found ${assets.length} assets with GLB links`);
    console.log();

    const results: LinkCheckResult[] = [];
    const categories: StatusCategories = {
      forbidden: [],
      notFound: [],
      noContent: [],
      successful: [],
      errors: [],
      noContentType: [],
    };

    // Process assets in batches
    for (let i = 0; i < assets.length; i += BATCH_SIZE) {
      const batch = assets.slice(i, i + BATCH_SIZE);
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(assets.length / BATCH_SIZE);
      const batchProgressPercent = Math.round(
        (batchNumber / totalBatches) * 100
      );

      console.log(
        `Processing batch ${batchNumber}/${totalBatches} (${batchProgressPercent}%) - ${batch.length} assets...`
      );

      const batchPromises = batch.map(async (asset, assetIndex) => {
        const currentAssetIndex = i + assetIndex;
        const assetProgressPercent = Math.round(
          ((currentAssetIndex + 1) / assets.length) * 100
        );

        console.log(
          `Checking: ${asset.product_name} (${asset.id}) [${currentAssetIndex + 1}/${assets.length} - ${assetProgressPercent}%]`
        );

        const result = await makeHeadRequest(asset.glb_link);
        const linkResult: LinkCheckResult = {
          asset,
          ...result,
        };

        results.push(linkResult);
        return linkResult;
      });

      const batchResults = await Promise.all(batchPromises);

      // Categorize results
      batchResults.forEach((result) => {
        if (result.status === "error" || result.status === "timeout") {
          categories.errors.push(result);
        } else if (result.httpStatus === 403) {
          categories.forbidden.push(result);
        } else if (result.httpStatus === 404) {
          categories.notFound.push(result);
        } else if (result.httpStatus === 204) {
          categories.noContent.push(result);
        } else if (
          result.httpStatus &&
          result.httpStatus >= 200 &&
          result.httpStatus < 300
        ) {
          categories.successful.push(result);
        } else {
          categories.errors.push(result);
        }
      });

      // Show progress after each batch completes
      const processedCount = Math.min(i + BATCH_SIZE, assets.length);
      const overallProgress = Math.round(
        (processedCount / assets.length) * 100
      );

      console.log(`\n📊 Progress Update (${overallProgress}% complete):`);
      console.log(`  ✅ Successful: ${categories.successful.length}`);
      console.log(`  🚫 Forbidden (403): ${categories.forbidden.length}`);
      console.log(`  ❌ Not Found (404): ${categories.notFound.length}`);
      console.log(`  📭 No Content (204): ${categories.noContent.length}`);
      console.log(`  ⚠️  Errors/Timeouts: ${categories.errors.length}`);
      console.log();

      // Small delay between batches to be respectful to servers
      if (i + BATCH_SIZE < assets.length) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    console.log();
    console.log("📊 SUMMARY");
    console.log("==================================================");
    console.log(`Total assets checked: ${assets.length}`);
    console.log(`✅ Successful (2xx): ${categories.successful.length}`);
    console.log(`🚫 Forbidden (403): ${categories.forbidden.length}`);
    console.log(`❌ Not Found (404): ${categories.notFound.length}`);
    console.log(`📭 No Content (204): ${categories.noContent.length}`);
    console.log(`⚠️  Errors/Timeouts: ${categories.errors.length}`);

    // Display detailed results
    if (categories.forbidden.length > 0) {
      console.log();
      console.log("🚫 FORBIDDEN (403):");
      categories.forbidden.forEach((result) => {
        console.log(
          `  • ${result.asset.product_name} (ID: ${result.asset.id})`
        );
        console.log(`    Client: ${result.asset.client}`);
        console.log(`    URL: ${result.asset.glb_link}`);
        console.log(`    Response time: ${result.responseTime}ms`);
        console.log();
      });
    }

    if (categories.notFound.length > 0) {
      console.log();
      console.log("❌ NOT FOUND (404):");
      categories.notFound.forEach((result) => {
        console.log(
          `  • ${result.asset.product_name} (ID: ${result.asset.id})`
        );
        console.log(`    Client: ${result.asset.client}`);
        console.log(`    URL: ${result.asset.glb_link}`);
        console.log(`    Response time: ${result.responseTime}ms`);
        console.log();
      });
    }

    if (categories.noContent.length > 0) {
      console.log();
      console.log("📭 NO CONTENT (204):");
      categories.noContent.forEach((result) => {
        console.log(
          `  • ${result.asset.product_name} (ID: ${result.asset.id})`
        );
        console.log(`    Client: ${result.asset.client}`);
        console.log(`    URL: ${result.asset.glb_link}`);
        console.log(`    Response time: ${result.responseTime}ms`);
        console.log();
      });
    }

    if (categories.errors.length > 0) {
      console.log();
      console.log("⚠️  ERRORS & TIMEOUTS:");
      categories.errors.forEach((result) => {
        console.log(
          `  • ${result.asset.product_name} (ID: ${result.asset.id})`
        );
        console.log(`    Client: ${result.asset.client}`);
        console.log(`    URL: ${result.asset.glb_link}`);
        console.log(`    Error: ${result.error || "Unknown error"}`);
        console.log(`    Status: ${result.status}`);
        if (result.responseTime) {
          console.log(`    Response time: ${result.responseTime}ms`);
        }
        console.log();
      });
    }

    if (categories.successful.length > 0) {
      console.log();
      console.log("✅ SUCCESSFUL LINKS:");
      console.log(`Found ${categories.successful.length} working GLB links`);

      // Show first 10 successful ones as examples
      const examples = categories.successful.slice(0, 10);
      examples.forEach((result) => {
        console.log(
          `  • ${result.asset.product_name} (ID: ${result.asset.id})`
        );
        console.log(`    Client: ${result.asset.client}`);
        console.log(`    Status: ${result.httpStatus}`);
        console.log(`    Response time: ${result.responseTime}ms`);
      });

      if (categories.successful.length > 10) {
        console.log(
          `  ... and ${categories.successful.length - 10} more working links`
        );
      }
    }

    // Generate CSV report
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .split("T")[0];
    const csvContent = [
      "ID,Product Name,Client,Category,Subcategory,GLB Link,Status,HTTP Status,Error,Response Time (ms)",
      ...results.map((result) =>
        [
          result.asset.id,
          `"${result.asset.product_name.replace(/"/g, '""')}"`,
          result.asset.client,
          result.asset.category,
          result.asset.subcategory,
          result.asset.glb_link,
          result.status,
          result.httpStatus || "",
          result.error ? `"${result.error.replace(/"/g, '""')}"` : "",
          result.responseTime || "",
        ].join(",")
      ),
    ].join("\n");

    const filename = `asset-link-check-${timestamp}.csv`;
    const filepath = join(process.cwd(), filename);
    writeFileSync(filepath, csvContent);
    console.log();
    console.log(`📄 Detailed report saved to: ${filename}`);

    // Exit with appropriate code
    const hasIssues =
      categories.forbidden.length > 0 ||
      categories.notFound.length > 0 ||
      categories.noContent.length > 0 ||
      categories.errors.length > 0;

    if (hasIssues) {
      process.exit(1);
    } else {
      console.log();
      console.log("🎉 All links are accessible!");
      process.exit(0);
    }
  } catch (error) {
    console.error("❌ Unexpected error:", error);
    process.exit(1);
  }
}

checkAssetLinks();
