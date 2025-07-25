import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files: File[] = [];
    for (const [key, value] of formData.entries()) {
      if (value instanceof File) {
        files.push(value);
      }
    }
    if (files.length === 0) {
      return NextResponse.json({ error: 'No files uploaded' }, { status: 400 });
    }
    const sessionId = randomUUID();
    // Prepare FormData for backend
    const backendFormData = new FormData();
    backendFormData.append('sessionId', sessionId);
    for (const file of files) {
      backendFormData.append('files', file, file.name);
    }
    const backendUrl = `${process.env.BACKEND_URL || 'http://localhost:8000'}/api/analyze/`;
    const backendResponse = await fetch(backendUrl, {
      method: 'POST',
      body: backendFormData,
      // Do not set Content-Type header manually
    });
    if (!backendResponse.ok) {
      const errorText = await backendResponse.text();
      return NextResponse.json({ error: 'Backend processing failed', details: errorText }, { status: 500 });
    }
    const result = await backendResponse.json();
    return NextResponse.json({ sessionId, ...result });
  } catch (error) {
    return NextResponse.json({ error: 'Upload failed', details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}