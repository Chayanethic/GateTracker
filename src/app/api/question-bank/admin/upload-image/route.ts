import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const maxDuration = 300;

const BUCKET = 'question-bank-images';

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function adminOk(req: Request) {
  return req.headers.get('x-admin-email') === process.env.NEXT_PUBLIC_ADMIN_EMAIL &&
    req.headers.get('x-admin-password') === process.env.NEXT_PUBLIC_ADMIN_PASSWORD;
}

function safePart(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 80) || 'import';
}

export async function POST(req: Request) {
  if (!adminOk(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  try {
    const form = await req.formData();
    const file = form.get('file');
    const prefix = safePart(String(form.get('prefix') || 'qb/import'));

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Image file is required.' }, { status: 400 });
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    if (!bytes.length) return NextResponse.json({ error: 'Image file is empty.' }, { status: 400 });
    if (bytes.length > 15 * 1024 * 1024) {
      return NextResponse.json({ error: 'Individual image is larger than 15 MB.' }, { status: 413 });
    }

    const mime = file.type || 'image/png';
    if (!/^image\//i.test(mime)) {
      return NextResponse.json({ error: 'Only image files are allowed.' }, { status: 400 });
    }

    const ext = (mime.split('/')[1] || 'png').replace(/[^a-z0-9]/gi, '') || 'png';
    const digest = createHash('sha256').update(bytes).digest('hex').slice(0, 20);
    const path = `${prefix}/${digest}.${ext}`;

    const client = db();
    const { error } = await client.storage.from(BUCKET).upload(path, bytes, {
      contentType: mime,
      upsert: false,
      cacheControl: '31536000',
    });

    if (error && !/already exists|duplicate|409/i.test(error.message)) {
      throw new Error(`Image upload failed: ${error.message}`);
    }

    const { data } = client.storage.from(BUCKET).getPublicUrl(path);
    return NextResponse.json({ ok: true, url: data.publicUrl, path });
  } catch (error: any) {
    console.error('Question bank image upload failed:', error);
    return NextResponse.json({ error: error?.message || 'Image upload failed.' }, { status: 500 });
  }
}
