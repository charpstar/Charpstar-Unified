# GLB Link Checker Script

This script checks all GLB links for a specific client in the Assets table to verify if the links are accessible.

## Features

- ✅ Checks GLB links using HEAD requests (faster than GET)
- 🔄 Processes links in batches to avoid overwhelming servers
- ⏱️ 10-second timeout per request
- 📊 Detailed reporting with success/error counts
- 📄 Generates CSV report with detailed results
- 🎯 Focuses on specific client (currently configured for Synsam)

## Usage

### Prerequisites

1. Install dependencies:

```bash
npm install
```

2. Make sure you have the required environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### Running the Script

**Option 1: Using npm script (recommended)**

```bash
npm run check-glb-links
```

**Option 2: Using npx tsx directly**

```bash
npx tsx scripts/check-glb-links.ts
```

**Option 3: Using the batch file (Windows)**

```bash
scripts/check-glb-links.bat
```

**Option 4: Direct execution (if tsx is installed globally)**

```bash
tsx scripts/check-glb-links.ts
```

## Output

The script will:

1. **Fetch all assets** for the specified client (Synsam) that have GLB links
2. **Check each link** using HEAD requests with a 10-second timeout
3. **Display progress** as it checks each asset
4. **Show summary** with counts of successful, error, and timeout results
5. **List problematic links** with detailed error information
6. **Generate CSV report** with all results saved to a timestamped file

### Example Output

```
🔍 Checking GLB links for client: Synsam
==================================================
Found 150 assets with GLB links

Checking: Product Name 1 (asset-id-1)
Checking: Product Name 2 (asset-id-2)
...

📊 SUMMARY
==================================================
Total assets checked: 150
✅ Successful: 145
❌ Errors: 3
⏱️  Timeouts: 2

❌ ERRORS:
  • Product Name 1 (ID: asset-id-1)
    URL: https://example.com/model1.glb
    Error: HTTP 404: Not Found
    Status Code: 404

⏱️  TIMEOUTS:
  • Product Name 2 (ID: asset-id-2)
    URL: https://slow-server.com/model2.glb
    Error: Request timeout

📄 Detailed report saved to: glb-link-check-synsam-2024-01-15.csv
```

## Configuration

To check a different client, modify the `CLIENT_NAME` constant in the script:

```typescript
const CLIENT_NAME = "YourClientName";
```

## CSV Report

The generated CSV file includes:

- Product Name
- Asset ID
- GLB Link URL
- Status (success/error/timeout)
- HTTP Status Code (if applicable)
- Error Message (if any)
- Response Time in milliseconds

## Exit Codes

- `0`: All links are accessible
- `1`: Some links have errors or timeouts

This makes the script suitable for use in CI/CD pipelines or automated monitoring.
