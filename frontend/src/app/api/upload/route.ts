import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files = [];
    
    // Extract all files from formData
    for (const [key, value] of formData.entries()) {
      if (value instanceof File) {
        files.push(value);
      }
    }

    if (files.length === 0) {
      return NextResponse.json({ error: 'No files uploaded' }, { status: 400 });
    }

    // Generate session ID
    const sessionId = randomUUID();
    const uploadDir = join(process.cwd(), 'uploads', sessionId);
    
    // Create upload directory
    await mkdir(uploadDir, { recursive: true });

    // Save files
    const savedFiles = [];
    for (const file of files) {
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const filePath = join(uploadDir, file.name);
      await writeFile(filePath, buffer);
      savedFiles.push({
        name: file.name,
        size: file.size,
        type: file.type,
        path: filePath
      });
    }

    // Forward to backend for processing
    const backendResponse = await fetch(`${process.env.BACKEND_URL || 'http://localhost:8000'}/api/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sessionId,
        files: savedFiles
      }),
    });

    if (!backendResponse.ok) {
      throw new Error('Backend processing failed');
    }

    const result = await backendResponse.json();

    return NextResponse.json({
      sessionId,
      files: savedFiles,
      ...result
    });

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Upload failed' },
      { status: 500 }
    );
  }
}