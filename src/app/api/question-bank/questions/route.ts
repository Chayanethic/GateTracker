import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

async function getUser(req: Request) {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');

  if (!token) return null;

  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    }
  );

  const { data, error } = await client.auth.getUser(token);

  return error || !data.user ? null : data.user;
}

export async function GET(req: Request) {
  try {
    // ------------------------------------------------------------
    // AUTHENTICATION
    // ------------------------------------------------------------
    const user = await getUser(req);

    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required.' },
        { status: 401 }
      );
    }

    // ------------------------------------------------------------
    // QUERY PARAMETERS
    // ------------------------------------------------------------
    const { searchParams } = new URL(req.url);

    const chapterId = searchParams.get('chapterId');
    const difficulty = searchParams.get('difficulty');
    const topic = searchParams.get('topic');

    if (!chapterId) {
      return NextResponse.json(
        { error: 'chapterId is required.' },
        { status: 400 }
      );
    }

    // ------------------------------------------------------------
    // DATABASE
    // ------------------------------------------------------------
    const db = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // IMPORTANT:
    // Do NOT use:
    // source_question_type:raw_data->>questionType
    //
    // We already receive raw_data and can safely read
    // questionType below in JavaScript.
    let query = db
      .from('qb_questions')
      .select(
        `
        id,
        external_id,
        question_number,
        question_type,
        question_html,
        options,
        explanation_html,
        difficulty,
        topic,
        tags,
        marks,
        negative_marks,
        source,
        exam_year,
        image_urls,
        option_image_urls,
        raw_data
        `
      )
      .eq('chapter_id', chapterId)
      .eq('is_published', true)
      .order('question_number', { ascending: true });

    // ------------------------------------------------------------
    // OPTIONAL FILTERS
    // ------------------------------------------------------------
    if (
      difficulty &&
      ['easy', 'medium', 'hard'].includes(difficulty)
    ) {
      query = query.eq('difficulty', difficulty);
    }

    if (topic) {
      query = query.ilike('topic', `%${topic}%`);
    }

    // ------------------------------------------------------------
    // FETCH QUESTIONS
    // ------------------------------------------------------------
    const {
      data: questions,
      error: questionsError,
    } = await query;

    if (questionsError) {
      console.error(
        '[QUESTION BANK] Failed to fetch questions:',
        questionsError
      );

      return NextResponse.json(
        {
          error: `Unable to load questions: ${questionsError.message}`,
        },
        { status: 500 }
      );
    }

    // ------------------------------------------------------------
    // FETCH USER PROGRESS
    // ------------------------------------------------------------
    const ids = (questions || []).map((q: any) => q.id);

    let progress: any[] = [];

    if (ids.length > 0) {
      const {
        data: progressData,
        error: progressError,
      } = await db
        .from('qb_question_progress')
        .select(
          `
          question_id,
          attempted_count,
          correct_count,
          incorrect_count,
          last_result,
          bookmarked,
          marked_for_review
          `
        )
        .eq('user_id', user.id)
        .in('question_id', ids);

      // Progress should never prevent the questions themselves
      // from loading.
      if (progressError) {
        console.error(
          '[QUESTION BANK] Failed to fetch question progress:',
          progressError
        );
      } else {
        progress = progressData || [];
      }
    }

    const progressMap = new Map(
      progress.map((p: any) => [p.question_id, p])
    );

    // ------------------------------------------------------------
    // PRESERVE ORIGINAL QUESTION ORDER
    // ------------------------------------------------------------
    const orderedQuestions = [...(questions || [])].sort(
      (a: any, b: any) => {
        const ao = Number(a?.raw_data?.order);
        const bo = Number(b?.raw_data?.order);

        const an = Number(a?.question_number);
        const bn = Number(b?.question_number);

        const av = Number.isFinite(ao)
          ? ao
          : Number.isFinite(an)
            ? an
            : Number.MAX_SAFE_INTEGER;

        const bv = Number.isFinite(bo)
          ? bo
          : Number.isFinite(bn)
            ? bn
            : Number.MAX_SAFE_INTEGER;

        if (av !== bv) {
          return av - bv;
        }

        return String(
          a?.external_id || a?.id || ''
        ).localeCompare(
          String(b?.external_id || b?.id || '')
        );
      }
    );

    // ------------------------------------------------------------
    // PREPARE SAFE QUESTIONS FOR FRONTEND
    // ------------------------------------------------------------
    const safeQuestions = orderedQuestions.map(
      (q: any, displayIndex: number) => {
        const sourceType = String(
          q?.raw_data?.questionType || ''
        )
          .trim()
          .toUpperCase();

        const normalizedType =
          ['NAT', 'INTEGER', 'NUMERIC'].includes(sourceType) ||
          q.question_type === 'NAT'
            ? 'NAT'
            : [
                'MSQ',
                'MULTI',
                'MULTIPLE',
                'MULTIPLE_CHOICE',
                'MULTI_SELECT',
                'MULTISELECT',
              ].includes(sourceType) ||
              q.question_type === 'MSQ'
              ? 'MSQ'
              : [
                  'MCQ',
                  'SINGLE',
                  'SINGLE_CHOICE',
                ].includes(sourceType) ||
                q.question_type === 'MCQ'
                ? 'MCQ'
                : q.question_type;

        // Do not expose raw_data to the browser.
        const {
          raw_data: _rawData,
          ...publicQuestion
        } = q;

        return {
          ...publicQuestion,

          // Display question numbers sequentially.
          question_number: displayIndex + 1,

          // Correctly normalize MCQ / MSQ / NAT.
          question_type: normalizedType,

          // User progress.
          progress:
            progressMap.get(q.id) || {
              attempted_count: 0,
              correct_count: 0,
              incorrect_count: 0,
              last_result: null,
              bookmarked: false,
              marked_for_review: false,
            },
        };
      }
    );

    // ------------------------------------------------------------
    // RESPONSE
    // ------------------------------------------------------------
    return NextResponse.json({
      chapter: chapterId,

      questions: safeQuestions,

      totals: {
        count: safeQuestions.length,

        attempted: safeQuestions.filter(
          (q: any) =>
            (q.progress?.attempted_count || 0) > 0
        ).length,

        bookmarked: safeQuestions.filter(
          (q: any) => q.progress?.bookmarked
        ).length,
      },
    });
  } catch (error: any) {
    console.error(
      '[QUESTION BANK] Unexpected error:',
      error
    );

    return NextResponse.json(
      {
        error:
          error?.message ||
          'Unexpected error while loading questions.',
      },
      { status: 500 }
    );
  }
}
