import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";

export async function GET(
  request: NextRequest,
  { params }: { params: { filename: string } }
) {
  try {
    const { filename } = params;

    // Serve the actual file from the downloads directory
    const filePath = join(process.cwd(), "public", "downloads", filename);
    
    try {
      const fileBuffer = await readFile(filePath);
      
      return new NextResponse(fileBuffer, {
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Content-Length': fileBuffer.length.toString(),
        },
      });
    } catch {
      // If file doesn't exist, return a placeholder
      const placeholderContent = `File ${filename} not found. This would be the download for ${filename}`;
      
      return new NextResponse(placeholderContent, {
        headers: {
          'Content-Type': 'text/plain',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    }

  } catch (error) {
    console.error("Error serving download:", error);
    return NextResponse.json(
      { error: "Failed to serve download" },
      { status: 500 }
    );
  }
}
