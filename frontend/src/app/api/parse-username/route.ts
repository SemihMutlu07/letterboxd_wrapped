import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { filename } = body;

    if (!filename || typeof filename !== 'string') {
      console.log('[LB] Backend: Invalid filename provided:', filename);
      return NextResponse.json({ username: null });
    }

    // Use regex to extract username from filename
    const regex = /^letterboxd-([^-\s]+)-/i;
    const match = filename.match(regex);

    if (match && match[1]) {
      const username = match[1].trim();
      console.log('[LB] Backend: Parsed username from filename:', filename, '→', username);
      return NextResponse.json({ username });
    } else {
      console.log('[LB] Backend: No username found in filename:', filename);
      return NextResponse.json({ username: null });
    }
  } catch (error) {
    console.error('[LB] Backend: Error parsing username:', error);
    return NextResponse.json({ username: null });
  }
}
