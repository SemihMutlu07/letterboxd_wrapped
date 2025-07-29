import { ImageResponse } from '@vercel/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const totalFilms = searchParams.get('totalFilms') ?? '0';
  const averageRating = searchParams.get('averageRating') ?? '0';
  const daysWatched = searchParams.get('daysWatched') ?? '0';
  const topGenre = searchParams.get('topGenre') ?? 'N/A';
  const topDirector = searchParams.get('topDirector') ?? 'N/A';

  return new ImageResponse(
    (
      <div style={{
        background: 'linear-gradient(180deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        fontFamily: 'Inter, sans-serif',
        padding: '80px 40px'
      }}>
        <h1 style={{ 
          fontSize: '72px', 
          marginBottom: '80px',
          textAlign: 'center',
          lineHeight: '1.2'
        }}>
          Your <span style={{ 
            color: '#ff6b6b'
          }}>Letterboxd</span><br/>Wrapped
        </h1>
        
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '60px', 
          alignItems: 'center',
          marginBottom: '80px' 
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '64px', fontWeight: 'bold' }}>{totalFilms}</div>
            <div style={{ fontSize: '24px', color: '#888' }}>Films Watched</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '64px', fontWeight: 'bold' }}>{averageRating}★</div>
            <div style={{ fontSize: '24px', color: '#888' }}>Average Rating</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '64px', fontWeight: 'bold' }}>{daysWatched}</div>
            <div style={{ fontSize: '24px', color: '#888' }}>Days Watched</div>
          </div>
        </div>
        
        <div style={{ fontSize: '28px', textAlign: 'center', lineHeight: '1.5' }}>
          <p style={{ marginBottom: '20px' }}>Top Genre: <strong>{topGenre}</strong></p>
          <p>Favorite Director: <strong>{topDirector}</strong></p>
        </div>
      </div>
    ),
    {
      width: 1080,
      height: 1920,
    }
  );
} 