# Automated QA System

This document describes the automated QA system integrated into the Charpstar-Unified application for modelers.

## Overview

The automated QA system provides AI-powered quality assurance for 3D models uploaded by modelers. It automatically captures screenshots from multiple angles and compares them against reference images to ensure visual accuracy and quality.

## Features

- **Automatic Screenshot Capture**: Captures 5 screenshots from different angles (front, back, left, right, top)
- **AI-Powered Analysis**: Uses Google's Gemini 2.5 Flash to compare renders against reference images
- **Technical Requirements Check**: Validates triangle count, material count, file size, and double-sided materials
- **Queue Management**: Handles multiple QA jobs with rate limiting and retry logic
- **Real-time Results**: Provides detailed similarity scores and issue reports

## Components

### API Endpoints

- `POST /api/qa-jobs` - Create a new QA job
- `GET /api/qa-jobs?jobId=<id>` - Check job status and get results
- `POST /api/qa-screenshots` - Create QA job for screenshot capture
- `PUT /api/qa-screenshots` - Update job with captured screenshots

### Frontend Components

- `AutomatedQA` - Main QA workflow component
- `ScreenshotCapture` - Handles screenshot capture from model-viewer
- `QAResults` - Displays QA analysis results

### Database

- `qa_jobs` table stores QA job information and results

## Workflow

1. **Model Upload**: When a modeler uploads a GLB file, the system checks for reference images
2. **QA Trigger**: If reference images exist, the automated QA dialog opens
3. **Screenshot Capture**: System captures 5 screenshots from different angles
4. **AI Analysis**: Screenshots are compared against reference images using AI
5. **Results Display**: Detailed results with similarity scores and issues are shown

## Configuration

### Environment Variables

- `GEMINI_API_KEY` - Required for AI analysis (Google Gemini)
- `MAX_CONCURRENT_QA_JOBS` - Maximum concurrent QA jobs (default: 3)
- `MAX_QUEUE_SIZE` - Maximum queue size (default: 20)

### Technical Requirements

The system can validate against technical requirements:

```typescript
{
  maxTriangles: number;
  maxMaterials: number;
  maxFileSize: number;
}
```

## Integration

The QA system is integrated into the modeler review page (`/modeler-review/[id]`). When a modeler uploads a GLB file:

1. The file is uploaded to Supabase storage
2. Reference images are fetched from the database
3. If reference images exist, the QA dialog opens automatically
4. The modeler can start the automated QA process

## Usage

### For Modelers

1. Upload a GLB file as usual
2. If reference images are available, the QA dialog will open automatically
3. Click "Start Automated QA" to begin the process
4. Wait for screenshots to be captured (5 different angles)
5. Review the AI analysis results
6. Address any issues found or proceed if approved

### For Developers

The QA system can be extended by:

- Adding new technical requirements checks
- Modifying the AI prompt for different analysis criteria
- Adding new screenshot angles
- Customizing the results display

## Database Schema

```sql
CREATE TABLE qa_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    status TEXT NOT NULL DEFAULT 'pending',
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    error TEXT,
    qa_results JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Status Values

- `pending` - Job created but not yet queued
- `queued` - Job is in the processing queue
- `processing` - Job is currently being processed
- `screenshots_captured` - Screenshots have been captured
- `complete` - Job completed successfully
- `failed` - Job failed with an error

## Similarity Scores

The AI analysis provides similarity scores for:

- **Silhouette**: Overall shape and outline comparison
- **Proportion**: Relative sizes of parts comparison
- **Color/Material**: Colors, textures, and materials comparison
- **Overall**: Weighted average of all factors

## Approval Criteria

- Overall score ≥ 70% → "Approved"
- Overall score < 70% → "Not Approved"

## Error Handling

The system includes comprehensive error handling:

- Rate limiting to prevent abuse
- Retry logic for failed jobs
- Queue management to handle high load
- Graceful degradation when services are unavailable

## Future Enhancements

Potential improvements include:

- Batch processing for multiple models
- Custom QA criteria per client
- Integration with external QA services
- Advanced 3D model analysis
- Performance metrics and analytics

