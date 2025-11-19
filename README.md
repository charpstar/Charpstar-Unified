# GLB Processor - 8 Views Implementation

This implementation captures **8 screenshots** of 3D GLB models from different camera angles using Puppeteer and Google's model-viewer component.

## Features

- ✅ Captures 8 different views of each 3D model
- ✅ Uses Puppeteer for headless browser automation
- ✅ Uses Google's model-viewer component for 3D rendering
- ✅ Uploads images to BunnyCDN Storage
- ✅ Updates `preview_images` column in Supabase database

## Camera Views

| View # | View Name             | View Index | Camera Orbit      | Description                          |
| ------ | --------------------- | ---------- | ----------------- | ------------------------------------ |
| 1      | front                 | 0          | 0deg 90deg 5.5m   | Primary view, shows main features    |
| 2      | back                  | 1          | 180deg 90deg 5.5m | Shows rear structure/details         |
| 3      | left                  | 2          | 90deg 90deg 5.5m  | Profile view, shows depth            |
| 4      | right                 | 3          | 270deg 90deg 5.5m | Opposite profile                     |
| 5      | top                   | 4          | 0deg 0deg 5.5m    | Surface view, layout, dimensions     |
| 6      | bottom                | 5          | 0deg 180deg 5.5m  | Underside, base structure            |
| 7      | isometric_front_right | 6          | 45deg 70deg 5.5m  | 3/4 view, overall shape (45° angled) |
| 8      | isometric_front_left  | 7          | 315deg 70deg 5.5m | Opposite 3/4 view (45° angled)       |

## Database Setup

### Column Type for `preview_images`

**Recommended: `text[]` (PostgreSQL array of text)**

This is the best option for storing multiple image URLs. It allows you to:

- Store an array of URLs directly
- Query individual elements
- Maintain order of images

**Alternative: `jsonb`**

If you need more flexibility (e.g., storing metadata with each image), use `jsonb`:

```json
[
  {"url": "https://...", "view": "front", "index": 0},
  {"url": "https://...", "view": "back", "index": 1},
  ...
]
```

### SQL Migration

Run the migration file `migration.sql` or execute these commands:

```sql
-- Add preview_images column to assets table (used by this processor)
ALTER TABLE assets
ADD COLUMN IF NOT EXISTS preview_images text[];
```

**Note:** This implementation uses the `assets` table. The processor queries and updates the `assets` table.

## Installation

```bash
cd glb_processor_8views
npm install
```

## Environment Variables

Create a `.env` file:

```env
# Supabase Configuration (for database queries)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# BunnyCDN Configuration (for image uploads)
BUNNY_STORAGE_ZONE=maincdn
BUNNY_API_KEY=your-bunny-api-key
BUNNY_CDN_HOSTNAME=maincdn.bunnycdn.com
```

**BunnyCDN Setup:**

1. Get your API key from BunnyCDN dashboard (Account → API Keys)
2. Set `BUNNY_STORAGE_ZONE` to your storage zone name (e.g., "maincdn")
3. Set `BUNNY_CDN_HOSTNAME` to your CDN hostname (default: `{storageZone}.bunnycdn.com`)
4. Images will be uploaded to: `Platform/glb-images/{clientName}/{article_id}/`

## Usage

### Process all GLB files for a client (default behavior):

```bash
node glb_processor.js <client_name>
```

Or using npm:

```bash
npm start -- <client_name>
```

### Dry run (generate screenshots but don't upload or update database):

```bash
node glb_processor.js <client_name> --dry-run
```

Or using npm:

```bash
npm run dry-run -- <client_name>
```

### Process only new uploads (new_upload=true):

```bash
node glb_processor.js <client_name> --new-only
```

### Command Line Options

- `--dry-run` or `--dry`: Generate screenshots locally but skip uploads and database updates
- `--new-only` or `--new`: Process only files with `new_upload=true` (default: process all files with GLB links)

**Note:** By default, the processor will process **all files with GLB links** for the specified client, regardless of the `new_upload` status.

## Output

- **Local files**: Screenshots saved to `output/<article_id>/view_<N>_<view_name>.jpg`
- **BunnyCDN Storage**: Images uploaded to `Platform/glb-images/<client_name>/<article_id>/` (skipped in dry-run mode)
  - Public URL format: `https://{cdnHostname}/Platform/glb-images/{clientName}/{article_id}/{article_id}_view_{N}_{viewName}.jpg`
- **Database**: `preview_images` column updated with array of image URLs (skipped in dry-run mode)
- **Results**: Processing results saved to `output/results.jsonl`

### Dry-Run Mode

When using `--dry-run`, the processor will:

- ✅ Generate all 8 screenshots for each GLB file
- ✅ Save screenshots locally to `output/<article_id>/` directory
- ✅ Display file paths in console
- ❌ Skip uploading to BunnyCDN Storage
- ❌ Skip updating the database
- ❌ Skip cleaning up local files (so you can view the screenshots)

## Example Output

Each GLB file will generate 8 images:

- `view_1_front.jpg`
- `view_2_back.jpg`
- `view_3_left.jpg`
- `view_4_right.jpg`
- `view_5_top.jpg`
- `view_6_bottom.jpg`
- `view_7_isometric_front_right.jpg`
- `view_8_isometric_front_left.jpg`

## Notes

- Uses distance of `5.5m` for camera orbit (slightly zoomed out from 100%)
- Screenshots are 1920x1080 pixels
- JPEG quality: 90%
- Each view takes approximately 3-5 seconds to capture
