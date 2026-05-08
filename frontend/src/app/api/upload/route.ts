import { NextRequest, NextResponse } from "next/server";

export async function POST() {
    return NextResponse.json(
        { 
            error: 'Not Implemented', 
            message: 'Static export does not support server-side API routes. Use the backend API directly.' 
        }, 
        { status: 501 }
    );
}