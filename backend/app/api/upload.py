import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const files = [];
        
        for (const [key, value] of formData.entries()) {
            if (value instanceof File) {
                files.push(value);
            }
        }
        
        if (files.length === 0) {
            return NextResponse.json({ error: 'No files uploaded' }, { status: 400 });
        }
        
        const sessionId = randomUUID();
        const uploadDir = join(process.cwd(), 'uploads', sessionId);
    }
}