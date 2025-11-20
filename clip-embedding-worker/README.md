# CLIP Embedding Worker

Standalone package for generating CLIP embeddings for product images. This is isolated from the main application to avoid deploying heavy ML dependencies to serverless environments.

## What This Does

Generates semantic embeddings for product images using the CLIP (Contrastive Language-Image Pre-training) model. These embeddings enable semantic similarity search beyond exact pixel matches.

## Prerequisites

- Node.js 18+
- Access to your Supabase database
- At least 2GB RAM available
- ~500MB disk space (for model cache)

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

Edit `.env`:
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

## Usage

### Process All Assets

```bash
npm run generate
```

### Process Limited Assets (Recommended for Testing)

```bash
tsx generate-embeddings.ts --limit 10
```

### Process Specific Client

```bash
tsx generate-embeddings.ts --client "ClientName"
```

### Combined Options

```bash
tsx generate-embeddings.ts --limit 50 --client "BigClient"
```

## What Happens on First Run

1. Downloads ~500MB CLIP model to `.cache/transformers/`
2. Model stays cached for subsequent runs
3. Each image takes ~2-5 seconds to process
4. Progress updates every 10 images

## Expected Performance

- **First run**: ~10-30 seconds to download model
- **Processing speed**: ~2-5 seconds per image
- **Memory usage**: ~1-2GB RAM
- **For 1000 images**: ~1-1.5 hours

## Output

The script saves embeddings to the `product_embeddings` table in your database:

- `asset_id`: UUID reference to product
- `embedding`: 512-dimensional vector
- `model_version`: 'clip-vit-base-patch32'
- `created_at`, `updated_at`: Timestamps

## Resumable

The script automatically skips assets that already have embeddings. You can:
- Stop and restart anytime
- Run incrementally as new products are added
- Re-run safely without duplicating work

## Troubleshooting

### Out of Memory
- Reduce batch size (already processing 1 at a time)
- Close other applications
- Process in smaller chunks with `--limit`

### Slow Performance
- First run downloads model (one-time)
- Subsequent runs should be faster
- Network speed affects image fetching

### Failed Images
- Script continues on errors
- Check final report for failed count
- Failed assets can be retried

## After Completion

Once embeddings are generated:
1. You can delete this folder (keep it if you need to process more images later)
2. The embeddings are in your database
3. Your main app can query them for similarity search

## Notes

- **Not for production**: This is a batch processing tool, not a production service
- **Run locally**: Do NOT deploy this to serverless (Vercel, Lambda, etc.)
- **One-time job**: Generate embeddings once, query them many times
