import { NextRequest, NextResponse } from 'next/server';
import { generateSchizoPost, generateProjectPost, analyzeMarket, MarketAnalysis } from '@/lib/ai';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, ...params } = body;

    let result: string | MarketAnalysis;

    switch (type) {
      case 'schizo':
        result = await generateSchizoPost(params.context);
        break;
      
      case 'project':
        if (!params.projectName || !params.tokenSymbol) {
          return NextResponse.json({
            success: false,
            error: 'projectName and tokenSymbol required',
          }, { status: 400 });
        }
        result = await generateProjectPost(params.projectName, params.tokenSymbol, params.context);
        break;
      
      case 'analyze':
        if (!params.marketData) {
          return NextResponse.json({
            success: false,
            error: 'marketData required',
          }, { status: 400 });
        }
        result = await analyzeMarket(params.marketData);
        break;
      
      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid type. Use: schizo, project, or analyze',
        }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      type,
      result,
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

