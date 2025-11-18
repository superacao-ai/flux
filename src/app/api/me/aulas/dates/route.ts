import { NextResponse } from 'next/server';

// Minimal GET handler to satisfy Next.js route type generation.
export async function GET() {
	return NextResponse.json({ success: true, data: [] });
}
