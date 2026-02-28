import { NextResponse } from 'next/server';

export function apiError(message: string, status: number = 500) {
  return NextResponse.json({ error: message }, { status });
}

export async function withErrorHandler<T>(
  handler: () => Promise<T>
): Promise<T | NextResponse> {
  try {
    return await handler();
  } catch (error) {
    console.error('API error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
