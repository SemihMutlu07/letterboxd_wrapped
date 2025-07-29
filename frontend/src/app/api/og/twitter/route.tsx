import { ImageResponse } from '@vercel/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const totalFilms = searchParams.get('totalFilms') ?? '0';
  const averageRating = searchParams.get('averageRating') ?? '0';
  const daysWatched = searchParams.get('daysWatched') ?? '0';
  const topGenre = searchParams.get('topGenre') ?? 'N/A';
  
  return new ImageResponse(
    (
      <div style={{
        background: 'linear-gradient(90deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        color: 'white',
        fontFamily: 'Inter, sans-serif',
        padding: '60px'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <h1 style={{ 
              fontSize: '80px', 
              textAlign: 'left',
              lineHeight: '1.1',
              marginBottom: '40px'
            }}>
              My <span style={{ 
                color: '#ff6b6b'
              }}>Letterboxd</span> Wrapped
            </h1>
            <p style={{fontSize: '32px', color: '#ccc'}}>Top Genre: <strong>{topGenre}</strong></p>
        </div>
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '30px'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', fontSize: '48px', fontWeight: 'bold' }}>
                <span style={{color: '#ff6b6b', marginRight: '20px'}}>■</span> {totalFilms} Films
            </div>
            <div style={{ display: 'flex', alignItems: 'center', fontSize: '48px', fontWeight: 'bold' }}>
                <span style={{color: '#4ecdc4', marginRight: '20px'}}>■</span> {averageRating}★ Avg. Rating
            </div>
            <div style={{ display: 'flex', alignItems: 'center', fontSize: '48px', fontWeight: 'bold' }}>
                <span style={{color: '#f9f871', marginRight: '20px'}}>■</span> {daysWatched} Days Watched
            </div>
        </div>
      </div>
    ),
    {
      width: 1920,
      height: 1080,
    }
  );
} 