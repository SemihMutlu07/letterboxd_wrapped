import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { filename } = body;

    if (!filename || typeof filename !== 'string') {
      return NextResponse.json({ username: null });
    }

    // Use regex to extract username from filename
    const regex = /^letterboxd-([^-\s]+)-/i;
    const match = filename.match(regex);

    if (match && match[1]) {
      const username = match[1].trim();
  
      return NextResponse.json({ username });
    } else {
      return NextResponse.json({ username: null });
    }
  } catch (error) {
    return NextResponse.json({ username: null });
  }
}
