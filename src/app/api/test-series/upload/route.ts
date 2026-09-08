import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const db = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

const clean = (h: string) =>
  h
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/\s+on[a-z]+\s*=\s*(["']).*?\1/gi, '')
    .replace(/javascript:/gi, '');

function adminOk(req: Request) {
  return (
    req.headers.get('x-admin-email') === process.env.NEXT_PUBLIC_ADMIN_EMAIL &&
    req.headers.get('x-admin-password') ===
      process.env.NEXT_PUBLIC_ADMIN_PASSWORD
  );
}

export async function POST(req: Request) {
  try {
    if (!adminOk(req))
      return NextResponse.json(
        { error: 'Admin authorization required.' },
        { status: 403 }
      );

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY)
      return NextResponse.json(
        { error: 'SUPABASE_SERVICE_ROLE_KEY is missing.' },
        { status: 500 }
      );

    const b = await req.json();

    if (
      !b.title ||
      !b.examName ||
      !b.durationMinutes ||
      !b.maxMarks ||
      !Array.isArray(b.questions) ||
      !b.questions.length
    ) {
      return NextResponse.json(
        { error: 'All fields and questions are required.' },
        { status: 400 }
      );
    }

    const questions = b.questions.map((q: any) => ({
      id: String(q.id),
      number: Number(q.number),
      type: String(q.type),
      questionHtml: clean(String(q.questionHtml || '')),
      options: (q.options || []).map((o: any) => ({
        key: String(o.key),
        html: clean(String(o.html || '')),
      })),
      marks: Number(q.marks),
      negativeMarks: Number(q.negativeMarks || 0),
    }));

    const keys = b.questions.map((q: any) => ({
      test_series_id: 'TEMP',
      id_in_test: String(q.id),
      number: Number(q.number),
      answer: (q.answer || []).map(String),
      solution_html: clean(String(q.solutionHtml || '')),
      video_url: q.videoUrl ? String(q.videoUrl) : null,
      question_type: String(q.type || 'MCQ').toUpperCase(),
      marks: Number(q.marks),
      negative_marks: Number(q.negativeMarks || 0),
    }));

    const { data, error } = await db()
      .from('test_series')
      .insert({
        title: String(b.title).trim(),
        exam_name: String(b.examName).trim(),
        duration_minutes: Number(b.durationMinutes),
        max_marks: Number(b.maxMarks),
        question_count: questions.length,
        questions,
        is_published: true,
      })
      .select('id')
      .single();

    if (error) throw error;

    const { error: keyError } = await db()
      .from('test_series_keys')
      .insert(
        keys.map(
          (
            k: {
              test_series_id: string;
              id_in_test: string;
              number: number;
              answer: string[];
              solution_html: string;
              video_url: string | null;
              question_type: string;
              marks: number;
              negative_marks: number;
            }
          ) => ({
            ...k,
            test_series_id: data.id,
          })
        )
      );

    if (keyError) {
      await db().from('test_series').delete().eq('id', data.id);
      throw keyError;
    }

    return NextResponse.json({
      id: data.id,
      questionCount: questions.length,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Upload failed.' },
      { status: 500 }
    );
  }
}
