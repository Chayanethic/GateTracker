import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

async function getUser(req: Request) {
  const token = req.headers
    .get('authorization')
    ?.replace(/^Bearer\s+/i, '');

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
    // DATABASE
    // ------------------------------------------------------------
    const db = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { searchParams } = new URL(req.url);

    /*
     * Optional stream filter.
     *
     * If ?stream=ece is supplied, only ECE subjects are returned.
     * If no stream is supplied, ALL published subjects are returned.
     *
     * This fixes the situation where the user's profile branch does
     * not exactly match the stream value stored in qb_subjects.
     */
    const requestedStream = String(
      searchParams.get('stream') || ''
    )
      .trim()
      .toLowerCase();

    // ------------------------------------------------------------
    // FETCH PUBLISHED SUBJECTS + CHAPTERS
    // ------------------------------------------------------------
    let subjectQuery = db
      .from('qb_subjects')
      .select(
        `
        id,
        name,
        description,
        sort_order,
        stream,
        exam_key,
        chapters:qb_chapters(
          id,
          name,
          description,
          sort_order,
          question_count,
          is_published
        )
        `
      )
      .eq('is_published', true)
      .order('sort_order', { ascending: true });

    if (requestedStream) {
      subjectQuery = subjectQuery.eq(
        'stream',
        requestedStream
      );
    }

    const {
      data: subjects,
      error: subjectError,
    } = await subjectQuery;

    if (subjectError) {
      console.error(
        '[QUESTION BANK] Subject fetch failed:',
        subjectError
      );

      return NextResponse.json(
        {
          error: `Unable to load subjects: ${subjectError.message}`,
        },
        { status: 500 }
      );
    }

    // ------------------------------------------------------------
    // REMOVE UNPUBLISHED CHAPTERS
    // ------------------------------------------------------------
    const subjectRows = (subjects || []).map((subject: any) => ({
      ...subject,

      chapters: (subject.chapters || [])
        .filter((chapter: any) => chapter.is_published)
        .sort(
          (a: any, b: any) =>
            Number(a.sort_order || 0) -
            Number(b.sort_order || 0)
        ),
    }));

    // ------------------------------------------------------------
    // COLLECT CHAPTER IDS
    // ------------------------------------------------------------
    const chapterIds = subjectRows.flatMap(
      (subject: any) =>
        subject.chapters.map(
          (chapter: any) => chapter.id
        )
    );

    const questionToChapter = new Map<
      string,
      string
    >();

    const chapterStats = new Map<
      string,
      {
        total: number;
        mcq: number;
        msq: number;
        nat: number;
        unknown: number;
        attempted: number;
        saved: number;
      }
    >();

    const attemptedIds = new Set<string>();
    const bookmarkedIds = new Set<string>();

    // ------------------------------------------------------------
    // FETCH QUESTIONS
    // ------------------------------------------------------------
    if (chapterIds.length > 0) {
      const {
        data: questions,
        error: questionError,
      } = await db
        .from('qb_questions')
        .select(
          `
          id,
          chapter_id,
          question_type,
          raw_data
          `
        )
        .in('chapter_id', chapterIds)
        .eq('is_published', true);

      if (questionError) {
        console.error(
          '[QUESTION BANK] Question statistics fetch failed:',
          questionError
        );

        return NextResponse.json(
          {
            error: `Unable to load question statistics: ${questionError.message}`,
          },
          { status: 500 }
        );
      }

      // ----------------------------------------------------------
      // BUILD QUESTION STATISTICS
      // ----------------------------------------------------------
      (questions || []).forEach((question: any) => {
        questionToChapter.set(
          question.id,
          question.chapter_id
        );

        const stat =
          chapterStats.get(question.chapter_id) || {
            total: 0,
            mcq: 0,
            msq: 0,
            nat: 0,
            unknown: 0,
            attempted: 0,
            saved: 0,
          };

        stat.total++;

        /*
         * Prefer raw_data.questionType when available because
         * imported questions may have the correct source type
         * there.
         */
        const sourceType = String(
          question?.raw_data?.questionType || ''
        )
          .trim()
          .toUpperCase();

        const databaseType = String(
          question?.question_type || ''
        )
          .trim()
          .toUpperCase();

        const type = sourceType || databaseType;

        if (
          ['MCQ', 'SINGLE', 'SINGLE_CHOICE'].includes(type)
        ) {
          stat.mcq++;
        } else if (
          [
            'MSQ',
            'MULTI',
            'MULTIPLE',
            'MULTIPLE_CHOICE',
            'MULTI_SELECT',
            'MULTISELECT',
          ].includes(type)
        ) {
          stat.msq++;
        } else if (
          ['NAT', 'INTEGER', 'NUMERIC'].includes(type)
        ) {
          stat.nat++;
        } else {
          stat.unknown++;
        }

        chapterStats.set(
          question.chapter_id,
          stat
        );
      });

      // ----------------------------------------------------------
      // FETCH USER PROGRESS
      // ----------------------------------------------------------
      const questionIds = (questions || []).map(
        (question: any) => question.id
      );

      if (questionIds.length > 0) {
        const {
          data: progress,
          error: progressError,
        } = await db
          .from('qb_question_progress')
          .select(
            `
            question_id,
            attempted_count,
            bookmarked
            `
          )
          .eq('user_id', user.id)
          .in('question_id', questionIds);

        /*
         * Progress failure should not make the whole Question Bank
         * disappear. The subjects/questions can still be displayed.
         */
        if (progressError) {
          console.error(
            '[QUESTION BANK] Progress fetch failed:',
            progressError
          );
        } else {
          (progress || []).forEach((row: any) => {
            if (
              Number(row.attempted_count || 0) > 0
            ) {
              attemptedIds.add(
                row.question_id
              );
            }

            if (row.bookmarked) {
              bookmarkedIds.add(
                row.question_id
              );
            }
          });
        }
      }
    }

    // ------------------------------------------------------------
    // APPLY ATTEMPTED COUNTS
    // ------------------------------------------------------------
    attemptedIds.forEach((questionId) => {
      const chapterId =
        questionToChapter.get(questionId);

      if (!chapterId) return;

      const stat =
        chapterStats.get(chapterId);

      if (stat) {
        stat.attempted++;
      }
    });

    // ------------------------------------------------------------
    // APPLY SAVED COUNTS
    // ------------------------------------------------------------
    bookmarkedIds.forEach((questionId) => {
      const chapterId =
        questionToChapter.get(questionId);

      if (!chapterId) return;

      const stat =
        chapterStats.get(chapterId);

      if (stat) {
        stat.saved++;
      }
    });

    // ------------------------------------------------------------
    // BUILD FINAL RESPONSE
    // ------------------------------------------------------------
    const result = subjectRows.map(
      (subject: any) => {
        const chapters =
          subject.chapters.map(
            (chapter: any) => {
              const stat =
                chapterStats.get(chapter.id) || {
                  total: 0,
                  mcq: 0,
                  msq: 0,
                  nat: 0,
                  unknown: 0,
                  attempted: 0,
                  saved: 0,
                };

              const total = stat.total;

              return {
                ...chapter,

                question_count: total,

                attempted_count:
                  stat.attempted,

                remaining_count:
                  Math.max(
                    0,
                    total - stat.attempted
                  ),

                progress_percent:
                  total > 0
                    ? Math.round(
                        (stat.attempted /
                          total) *
                          100
                      )
                    : 0,

                mcq_count: stat.mcq,
                msq_count: stat.msq,
                nat_count: stat.nat,
                unknown_count:
                  stat.unknown,

                saved_count: stat.saved,
              };
            }
          );

        const totalQuestions =
          chapters.reduce(
            (sum: number, chapter: any) =>
              sum +
              Number(
                chapter.question_count || 0
              ),
            0
          );

        const attempted =
          chapters.reduce(
            (sum: number, chapter: any) =>
              sum +
              Number(
                chapter.attempted_count || 0
              ),
            0
          );

        const saved =
          chapters.reduce(
            (sum: number, chapter: any) =>
              sum +
              Number(
                chapter.saved_count || 0
              ),
            0
          );

        return {
          id: subject.id,
          name: subject.name,
          description: subject.description,
          sort_order: subject.sort_order,
          stream: subject.stream,
          exam_key: subject.exam_key,

          chapters,

          total_questions:
            totalQuestions,

          attempted_count:
            attempted,

          remaining_count:
            Math.max(
              0,
              totalQuestions - attempted
            ),

          progress_percent:
            totalQuestions > 0
              ? Math.round(
                  (attempted /
                    totalQuestions) *
                    100
                )
              : 0,

          mcq_count:
            chapters.reduce(
              (sum: number, chapter: any) =>
                sum +
                Number(
                  chapter.mcq_count || 0
                ),
              0
            ),

          msq_count:
            chapters.reduce(
              (sum: number, chapter: any) =>
                sum +
                Number(
                  chapter.msq_count || 0
                ),
              0
            ),

          nat_count:
            chapters.reduce(
              (sum: number, chapter: any) =>
                sum +
                Number(
                  chapter.nat_count || 0
                ),
              0
            ),

          unknown_count:
            chapters.reduce(
              (sum: number, chapter: any) =>
                sum +
                Number(
                  chapter.unknown_count || 0
                ),
              0
            ),

          saved_count: saved,
        };
      }
    );

    // ------------------------------------------------------------
    // FINAL RESPONSE
    // ------------------------------------------------------------
    return NextResponse.json({
      subjects: result,
    });
  } catch (error: any) {
    console.error(
      '[QUESTION BANK] Unexpected structure error:',
      error
    );

    return NextResponse.json(
      {
        error:
          error?.message ||
          'Unexpected error while loading Question Bank.',
      },
      { status: 500 }
    );
  }
}
