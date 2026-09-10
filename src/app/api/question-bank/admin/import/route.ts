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

function hash(value: string) {
  return createHash('sha256').update(value).digest('hex').slice(0, 20);
}

async function uploadDataImage(client: ReturnType<typeof db>, dataUri: string, prefix: string) {
  const match = dataUri.match(/^data:([^;,]+)?(;base64)?,([\s\S]*)$/i);
  if (!match) return dataUri;

  const mime = match[1] || 'image/png';
  const isBase64 = Boolean(match[2]);
  let bytes: Buffer;
  try {
    bytes = isBase64
      ? Buffer.from(match[3], 'base64')
      : Buffer.from(decodeURIComponent(match[3]), 'utf8');
  } catch {
    return dataUri;
  }

  if (!bytes.length) return dataUri;
  const ext = mime.split('/')[1]?.replace(/[^a-z0-9]/gi, '') || 'png';
  const path = `${prefix}/${hash(dataUri)}.${ext}`;

  const { error } = await client.storage.from(BUCKET).upload(path, bytes, {
    contentType: mime,
    upsert: false,
    cacheControl: '31536000',
  });

  // 409 means another import already uploaded this deterministic path.
  if (error && !/already exists|duplicate|409/i.test(error.message)) {
    throw new Error(`Image upload failed: ${error.message}`);
  }

  const { data } = client.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

async function replaceImages(
  client: ReturnType<typeof db>,
  value: any,
  prefix: string,
  imageUrls: string[],
  optionImageUrls: Record<string, string>
): Promise<any> {
  if (typeof value === 'string') {
    const dataUriRegex = /data:image\/[a-z0-9.+-]+(?:;[^,]+)?,[\s\S]*?(?=(?:["')\s<]|$))/i;
    // Handle a string that is exactly a data URI first.
    if (/^data:image\//i.test(value)) {
      const url = await uploadDataImage(client, value, prefix);
      imageUrls.push(url);
      return url;
    }

    // Also handle HTML such as <img src="data:image/png;base64,...">
    if (/<img\b[^>]*src\s*=\s*["']data:image\//i.test(value)) {
      const replaced = await replaceHtmlImages(client, value, prefix, imageUrls);
      return replaced;
    }
    return value;
  }

  if (Array.isArray(value)) {
    const out = [];
    for (const item of value) out.push(await replaceImages(client, item, prefix, imageUrls, optionImageUrls));
    return out;
  }

  if (value && typeof value === 'object') {
    const out: Record<string, any> = {};
    for (const [key, item] of Object.entries(value)) {
      const child = await replaceImages(client, item, prefix, imageUrls, optionImageUrls);
      out[key] = child;
      if (/optionimages?/i.test(key) && child && typeof child === 'object') {
        for (const [k, v] of Object.entries(child as Record<string, any>)) {
          if (typeof v === 'string' && /^https?:\/\//.test(v)) optionImageUrls[k] = v;
        }
      }
    }
    return out;
  }

  return value;
}

async function replaceHtmlImages(
  client: ReturnType<typeof db>,
  html: string,
  prefix: string,
  imageUrls: string[]
) {
  const re = /(<img\b[^>]*\bsrc\s*=\s*["'])(data:image\/[^"']+)(["'][^>]*>)/gi;
  const matches = [...html.matchAll(re)];
  let out = html;
  for (const m of matches) {
    const url = await uploadDataImage(client, m[2], prefix);
    imageUrls.push(url);
    out = out.replace(m[2], url);
  }
  return out;
}

function answerArray(q: any): string[] {
  if (Array.isArray(q.correctAnswerMulti) && q.correctAnswerMulti.length) return q.correctAnswerMulti.map(String);
  if (q.correctAnswerMin != null || q.correctAnswerMax != null) {
    const vals = [q.correctAnswerMin, q.correctAnswerMax].filter(v => v != null);
    return vals.map(String);
  }
  if (Array.isArray(q.correctAnswer)) return q.correctAnswer.map(String);
  if (q.correctAnswer != null && q.correctAnswer !== '') return [String(q.correctAnswer)];
  if (q.answer != null) return Array.isArray(q.answer) ? q.answer.map(String) : [String(q.answer)];
  return [];
}

function normalizeOptions(raw: any): any[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((o: any, i: number) => {
    if (o && typeof o === 'object') {
      const key = o.key ?? o.id ?? o.value ?? String(i);
      return { ...o, key: String(key) };
    }
    return { key: String(i), html: String(o ?? '') };
  });
}

export async function POST(req: Request) {
  if (!adminOk(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  try {
    const body = await req.json();
    const subject = body.subject || {};
    const chapter = body.chapter || {};
    const questions = Array.isArray(body.questions) ? body.questions : [];

    const subjectName = String(subject.name ?? subject.title ?? '').trim();
    const chapterName = String(chapter.name ?? chapter.title ?? '').trim();
    if (!subjectName || !chapterName) {
      return NextResponse.json({ error: 'Subject and chapter names are required.' }, { status: 400 });
    }
    if (!questions.length) return NextResponse.json({ error: 'No questions found in this chapter.' }, { status: 400 });
    if (questions.length > 500) return NextResponse.json({ error: 'Import at most 500 questions per request.' }, { status: 413 });

    const client = db();
    const examKey = String(body.examKey || 'gate').trim().toLowerCase();
    const stream = String(body.stream || 'ece').trim().toLowerCase();

    const { data: sub, error: subError } = await client
      .from('qb_subjects')
      .upsert({
        external_id: subject.id != null ? String(subject.id) : null,
        name: subjectName,
        description: subject.description ?? null,
        sort_order: Number(subject.order ?? 0),
        exam_key: examKey,
        stream,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'exam_key,stream,name' })
      .select('id')
      .single();
    if (subError) return NextResponse.json({ error: subError.message }, { status: 500 });

    const { data: ch, error: chError } = await client
      .from('qb_chapters')
      .upsert({
        subject_id: sub.id,
        external_id: chapter.id != null ? String(chapter.id) : null,
        name: chapterName,
        description: chapter.description ?? null,
        sort_order: Number(chapter.order ?? 0),
        is_published: true,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'subject_id,name' })
      .select('id')
      .single();
    if (chError) return NextResponse.json({ error: chError.message }, { status: 500 });

    const rows: any[] = [];
    let uploadedImages = 0;

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i] || {};
      const questionHtml = String(q.questionHtml ?? q.question ?? q.questionText ?? '');
      const externalId = String(
        q.id ?? q.questionId ?? q.question_id ??
        `generated-${i + 1}-${hash(questionHtml).slice(0, 10)}`
      );

      const imageUrls: string[] = [];
      const optionImageUrls: Record<string, string> = {};
      const cleaned = await replaceImages(client, q, `qb/${stream}/${hash(subjectName)}/${hash(chapterName)}`, imageUrls, optionImageUrls);

      const rawOptions = cleaned.options ?? cleaned.choices ?? q.options ?? q.choices ?? [];
      const options = normalizeOptions(rawOptions).map((option: any, optionIndex: number) => {
        const image = optionImageUrls[String(option.key)] ?? optionImageUrls[String(optionIndex)];
        if (image && !String(option.html || '').includes(image)) {
          return { ...option, html: `${String(option.html || '')}<div class="qb-option-image"><img src="${image}" alt="" /></div>` };
        }
        return option;
      });
      const explanationHtml = String(cleaned.explanationHtml ?? cleaned.explanation ?? cleaned.solution ?? q.explanationHtml ?? q.explanation ?? q.solution ?? '');

      const rawType = String(q.questionType ?? q.type ?? q.kind ?? '').toUpperCase();
      const questionType = ['MCQ','MSQ','NAT'].includes(rawType) ? rawType : 'UNKNOWN';
      const difficultyRaw = String(q.difficulty ?? q.level ?? '').toLowerCase();
      const difficulty = ['easy','medium','hard'].includes(difficultyRaw) ? difficultyRaw : null;
      const tags = Array.isArray(q.tags)
        ? q.tags.map(String).map(s => s.trim()).filter(Boolean).slice(0, 50)
        : (q.topic ? [String(q.topic)] : []);

      // Remove the largest image payloads from raw_data; everything else is retained.
      const safeRaw = JSON.parse(JSON.stringify(cleaned));
      delete safeRaw.imageData;
      delete safeRaw.optionImages;
      delete safeRaw.images;

      rows.push({
        chapter_id: ch.id,
        external_id: externalId,
        question_number: Number.isFinite(Number(q.questionNumber ?? q.number)) ? Number(q.questionNumber ?? q.number) : i + 1,
        question_type: questionType,
        question_html: String(cleaned.questionHtml ?? cleaned.question ?? cleaned.questionText ?? questionHtml),
        options,
        correct_answer: answerArray(q),
        explanation_html: explanationHtml,
        difficulty,
        topic: q.topic != null ? String(q.topic) : null,
        tags,
        marks: q.marks != null && Number.isFinite(Number(q.marks)) ? Number(q.marks) : null,
        negative_marks: (q.negativeMarks != null || q.negative_marks != null) ? Number(q.negativeMarks ?? q.negative_marks) : null,
        source: q.source != null ? String(q.source) : null,
        exam_year: q.examYear != null && Number.isFinite(Number(q.examYear)) ? Number(q.examYear) : null,
        image_urls: [...new Set(imageUrls)],
        option_image_urls: optionImageUrls,
        metadata: {
          originalKeys: Object.keys(q).slice(0, 100),
          importedAt: new Date().toISOString(),
        },
        raw_data: safeRaw,
        is_published: true,
        updated_at: new Date().toISOString(),
      });
      uploadedImages += imageUrls.length;
    }

    const { error: qError } = await client
      .from('qb_questions')
      .upsert(rows, { onConflict: 'chapter_id,external_id' });
    if (qError) return NextResponse.json({ error: qError.message }, { status: 500 });

    const { count } = await client
      .from('qb_questions')
      .select('id', { count: 'exact', head: true })
      .eq('chapter_id', ch.id);

    await client.from('qb_chapters').update({
      question_count: count || 0,
      updated_at: new Date().toISOString(),
    }).eq('id', ch.id);

    return NextResponse.json({
      ok: true,
      subjectId: sub.id,
      chapterId: ch.id,
      imported: rows.length,
      imageUploads: uploadedImages,
      questionCount: count || rows.length,
    });
  } catch (error: any) {
    console.error('Question bank import failed:', error);
    return NextResponse.json({ error: error?.message || 'Import failed.' }, { status: 500 });
  }
}
