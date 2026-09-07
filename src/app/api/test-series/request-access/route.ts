import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    {
      error:
        'Access requests are created from the authenticated browser session. Please use the Test Series page.'
    },
    { status: 400 }
  );
}
