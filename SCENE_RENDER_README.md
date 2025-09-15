# 3D Scene Renderer

This feature allows clients and administrators to generate photorealistic product scenes using AI.

## Setup

1. **Environment Variables**
   Add the following to your `.env.local` file:

   ```
   GEMINI_API_KEY=your_gemini_api_key_here
   ```

2. **Dependencies**
   The following packages are required and should already be installed:
   - `@google/genai` - For AI scene generation
   - `@react-three/fiber` - For 3D model rendering
   - `@react-three/drei` - For 3D utilities

## Features

- **File Upload**: Drag and drop .glb files
- **3D Preview**: Interactive 3D model viewer with orbit controls
- **Dimension Detection**: Automatic measurement of model dimensions
- **Scene Customization**: Multiple preset scenes or custom descriptions
- **Inspiration Images**: Optional style reference images
- **AI Generation**: Creates 5 different photorealistic scenes
- **Download**: Save generated images

## Usage

1. Navigate to "Scene Render" in the sidebar (available for clients and admins)
2. Upload a .glb file
3. Position and configure your model in the 3D viewer
4. Select product type and scene description
5. Optionally add an inspiration image
6. Click "Generate Scene" to create 5 different photorealistic renders
7. View, download, or create new scenes

## Permissions

- **Clients**: Can access after completing onboarding
- **Administrators**: Full access
- **Modelers/QA**: No access

## API Endpoints

- `POST /api/scene-render` - Generates scenes using Gemini AI
