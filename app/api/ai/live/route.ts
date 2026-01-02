import { NextResponse } from 'next/server';
import { 
  generateSchizoPost,
  generateDataDrivenPost,
  generateQuestionPost,
  generatePredictionPost
} from '@/lib/ai';
import { getAnusMarketData, formatMarketSummary } from '@/lib/data-feed';
import { logDebug, logError } from '@/lib/logger';

// Default $ANUS token address - replace with actual when launched
const DEFAULT_ANUS_MINT = process.env.ANUS_TOKEN_MINT || '';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || 'random';
  const mint = searchParams.get('mint') || DEFAULT_ANUS_MINT;
  
  if (!mint) {
    return NextResponse.json({
      success: false,
      error: 'No token mint address provided. Set ANUS_TOKEN_MINT env var or pass ?mint=...'
    }, { status: 400 });
  }

  try {
    // Fetch real market data
    logDebug('Fetching market data', { mint });
    const marketData = await getAnusMarketData(mint);
    
    if (!marketData.marketCap) {
      return NextResponse.json({
        success: false,
        error: 'Could not fetch token data. Make sure the mint address is valid.',
        mint
      }, { status: 404 });
    }

    const summary = formatMarketSummary(marketData);
    logDebug('Market summary', { summary });

    // Generate post based on type
    let post: string;
    let postType: string;

    if (type === 'random') {
      // Pick random type based on weights
      const rand = Math.random();
      if (rand < 0.3) {
        postType = 'schizo';
      } else if (rand < 0.6) {
        postType = 'data';
      } else if (rand < 0.8) {
        postType = 'question';
      } else {
        postType = 'prediction';
      }
    } else {
      postType = type;
    }

    switch (postType) {
      case 'schizo':
        post = await generateSchizoPost();
        break;
      case 'data':
        post = await generateDataDrivenPost(marketData);
        break;
      case 'question':
        post = await generateQuestionPost();
        break;
      case 'prediction':
        post = await generatePredictionPost(marketData);
        break;
      default:
        post = await generateSchizoPost();
        postType = 'schizo';
    }

    return NextResponse.json({
      success: true,
      post,
      postType,
      marketData,
      marketSummary: summary,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logError('Error generating live post', error as Error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

// POST endpoint to generate multiple posts at once
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { mint, count = 3 } = body;
    
    if (!mint) {
      return NextResponse.json({
        success: false,
        error: 'No token mint address provided in body'
      }, { status: 400 });
    }

    // Fetch market data once
    const marketData = await getAnusMarketData(mint);
    
    if (!marketData.marketCap) {
      return NextResponse.json({
        success: false,
        error: 'Could not fetch token data',
        mint
      }, { status: 404 });
    }

    // Generate multiple posts
    const posts = await Promise.all([
      generateSchizoPost(),
      generateDataDrivenPost(marketData),
      generateQuestionPost(),
      generatePredictionPost(marketData)
    ].slice(0, count));

    return NextResponse.json({
      success: true,
      posts,
      marketData,
      marketSummary: formatMarketSummary(marketData),
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logError('Error generating posts', error as Error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

