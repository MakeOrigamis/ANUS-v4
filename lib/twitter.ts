// ═══════════════════════════════════════════════════════════════════════════════
// PARRY TWITTER INTEGRATION - Posts to X/Twitter
// ═══════════════════════════════════════════════════════════════════════════════

import { TwitterApi } from 'twitter-api-v2';
import { logInfo, logError } from './logger';

// Twitter API v2 credentials
const TWITTER_API_KEY = process.env.TWITTER_API_KEY;
const TWITTER_API_SECRET = process.env.TWITTER_API_SECRET;
const TWITTER_ACCESS_TOKEN = process.env.TWITTER_ACCESS_TOKEN;
const TWITTER_ACCESS_SECRET = process.env.TWITTER_ACCESS_SECRET;

let twitterClient: TwitterApi | null = null;

/**
 * Initialize Twitter client
 */
function getTwitterClient(): TwitterApi {
  if (!TWITTER_API_KEY || !TWITTER_API_SECRET || !TWITTER_ACCESS_TOKEN || !TWITTER_ACCESS_SECRET) {
    throw new Error('Twitter API credentials not configured. Set TWITTER_API_KEY, TWITTER_API_SECRET, TWITTER_ACCESS_TOKEN, TWITTER_ACCESS_SECRET in .env');
  }

  if (!twitterClient) {
    twitterClient = new TwitterApi({
      appKey: TWITTER_API_KEY,
      appSecret: TWITTER_API_SECRET,
      accessToken: TWITTER_ACCESS_TOKEN,
      accessSecret: TWITTER_ACCESS_SECRET,
    });
  }

  return twitterClient;
}

/**
 * Post a tweet as PARRY
 */
export async function postTweet(text: string): Promise<{ success: boolean; tweetId?: string; error?: string }> {
  try {
    const client = getTwitterClient();
    const rwClient = client.readWrite;
    
    const tweet = await rwClient.v2.tweet(text);
    
    logInfo('Tweet posted', { tweetId: tweet.data.id });
    
    return {
      success: true,
      tweetId: tweet.data.id,
    };
  } catch (error) {
    logError('Error posting tweet', error as Error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Post a tweet with media (for future use)
 */
export async function postTweetWithMedia(
  text: string, 
  mediaBuffer: Buffer, 
  mediaType: 'image/png' | 'image/jpeg' | 'image/gif' | 'video/mp4'
): Promise<{ success: boolean; tweetId?: string; error?: string }> {
  try {
    const client = getTwitterClient();
    
    // Upload media
    const mediaId = await client.v1.uploadMedia(mediaBuffer, { mimeType: mediaType });
    
    // Post tweet with media
    const tweet = await client.v2.tweet({
      text,
      media: { media_ids: [mediaId] },
    });
    
    return {
      success: true,
      tweetId: tweet.data.id,
    };
  } catch (error) {
    logError('Error posting tweet with media', error as Error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Reply to a tweet
 */
export async function replyToTweet(
  text: string, 
  replyToTweetId: string
): Promise<{ success: boolean; tweetId?: string; error?: string }> {
  try {
    const client = getTwitterClient();
    
    const tweet = await client.v2.tweet({
      text,
      reply: { in_reply_to_tweet_id: replyToTweetId },
    });
    
    return {
      success: true,
      tweetId: tweet.data.id,
    };
  } catch (error) {
    logError('Error replying to tweet', error as Error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get recent mentions (for future auto-reply feature)
 */
export async function getMentions(sinceId?: string): Promise<{
  success: boolean;
  mentions?: Array<{ id: string; text: string; authorId: string }>;
  error?: string;
}> {
  try {
    const client = getTwitterClient();
    
    // Get authenticated user ID
    const me = await client.v2.me();
    
    // Get mentions
    const mentions = await client.v2.userMentionTimeline(me.data.id, {
      since_id: sinceId,
      max_results: 10,
    });
    
    return {
      success: true,
      mentions: mentions.data.data?.map(m => ({
        id: m.id,
        text: m.text,
        authorId: m.author_id || '',
      })) || [],
    };
  } catch (error) {
    logError('Error getting mentions', error as Error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check if Twitter is configured
 */
export function isTwitterConfigured(): boolean {
  return !!(TWITTER_API_KEY && TWITTER_API_SECRET && TWITTER_ACCESS_TOKEN && TWITTER_ACCESS_SECRET);
}

/**
 * Test Twitter connection
 */
export async function testTwitterConnection(): Promise<{ success: boolean; username?: string; error?: string }> {
  try {
    const client = getTwitterClient();
    const me = await client.v2.me();
    
    return {
      success: true,
      username: me.data.username,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

