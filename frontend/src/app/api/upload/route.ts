import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const data = await request.formData();
    const file: File | null = data.get('file') as unknown as File;
    
    if(!file) return NextResponse.json({ success: false });

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // This is a placeholder for your actual upload logic
    for (const [key, value] of data.entries()) {
        console.log(key, value);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Upload failed', details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}