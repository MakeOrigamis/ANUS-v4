import { NextResponse } from 'next/server';
import { postTweet, isTwitterConfigured, testTwitterConnection } from '@/lib/twitter';
import { 
  generateSchizoPost,
  generateDataDrivenPost,
  generateQuestionPost,
  generatePredictionPost
} from '@/lib/ai';
import { getAnusMarketData, formatMarketSummary } from '@/lib/data-feed';
import { logDebug, logError } from '@/lib/logger';

const ANUS_TOKEN_MINT = process.env.ANUS_TOKEN_MINT || '';

/**
 * GET - Test Twitter connection
 */
export async function GET() {
  if (!isTwitterConfigured()) {
    return NextResponse.json({
      success: false,
      error: 'Twitter not configured. Add TWITTER_API_KEY, TWITTER_API_SECRET, TWITTER_ACCESS_TOKEN, TWITTER_ACCESS_SECRET to .env'
    }, { status: 400 });
  }

  const result = await testTwitterConnection();
  return NextResponse.json(result);
}

/**
 * POST - Generate and post a tweet
 * Body: { type?: 'schizo' | 'data' | 'question' | 'prediction' | 'random', mint?: string, dryRun?: boolean }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { type = 'random', mint = ANUS_TOKEN_MINT, dryRun = false } = body;

    // Generate the post
    let post: string;
    let postType: string;
    let marketData = null;
    let marketSummary = '';

    // Fetch market data if we have a mint
    if (mint) {
      try {
        marketData = await getAnusMarketData(mint);
        marketSummary = formatMarketSummary(marketData);
        logDebug('Market data fetched', { summary: marketSummary });
      } catch (e) {
        logDebug('Could not fetch market data, generating without it');
      }
    }

    // Determine post type
    if (type === 'random') {
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

    // Generate post
    switch (postType) {
      case 'data':
        if (marketData && marketData.marketCap) {
          post = await generateDataDrivenPost(marketData);
        } else {
          post = await generateSchizoPost();
          postType = 'schizo (fallback)';
        }
        break;
      case 'prediction':
        if (marketData) {
          post = await generatePredictionPost(marketData);
        } else {
          post = await generateSchizoPost();
          postType = 'schizo (fallback)';
        }
        break;
      case 'question':
        post = await generateQuestionPost();
        break;
      case 'schizo':
      default:
        post = await generateSchizoPost();
        postType = 'schizo';
    }

    // If dry run, just return the generated post without posting
    if (dryRun) {
      return NextResponse.json({
        success: true,
        dryRun: true,
        post,
        postType,
        marketData,
        marketSummary,
        message: 'Dry run - tweet NOT posted'
      });
    }

    // Check Twitter is configured
    if (!isTwitterConfigured()) {
      return NextResponse.json({
        success: false,
        error: 'Twitter not configured',
        generatedPost: post,
        postType
      }, { status: 400 });
    }

    // Post the tweet
    const result = await postTweet(post);

    if (result.success) {
      return NextResponse.json({
        success: true,
        tweetId: result.tweetId,
        tweetUrl: `https://twitter.com/i/web/status/${result.tweetId}`,
        post,
        postType,
        marketData,
        marketSummary,
        timestamp: new Date().toISOString()
      });
    } else {
      return NextResponse.json({
        success: false,
        error: result.error,
        generatedPost: post,
        postType
      }, { status: 500 });
    }

  } catch (error) {
    logError('Error in tweet endpoint', error as Error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

