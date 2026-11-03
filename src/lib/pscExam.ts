export type PscQuestionType = 'MCQ' | 'NAT' | 'MSQ';

export type PscOption = {
  id: string;
  text: string;
  imageUrl?: string;
};

export type PscQuestion = {
  id: string;
  type: PscQuestionType;
  topic?: string;
  questionText: string;
  questionImageUrl?: string;
  options: PscOption[];
  correctAnswer: string;
  marks: number;
  negativeMarks: number;
  explanation?: string;
  solutionImageUrl?: string;
};

export type PscExamPaper = {
  title: string;
  category: string;
  stream: string;
  durationMinutes: number;
  totalMarks: number;
  questions: PscQuestion[];
};

export const SAMPLE_PSC_EXAM_JSON: PscExamPaper = {
  title: 'GATE CS Mock Test 1 - Algorithms & Data Structures',
  category: 'Subject Wise',
  stream: 'CS',
  durationMinutes: 45,
  totalMarks: 10,
  questions: [
    {
      id: 'q1',
      type: 'MCQ',
      topic: 'Algorithms',
      questionText: 'What is the worst-case time complexity of <u>QuickSort</u>?',
      questionImageUrl: '',
      options: [
        { id: 'A', text: 'O(n log n)', imageUrl: '' },
        { id: 'B', text: 'O(n^2)', imageUrl: '' },
        { id: 'C', text: 'O(n)', imageUrl: '' },
        { id: 'D', text: 'O(log n)', imageUrl: '' },
      ],
      correctAnswer: 'B',
      marks: 2,
      negativeMarks: 0.66,
      explanation:
        'Worst-case occurs when the pivot is always the smallest or largest element, leading to O(n^2).',
      solutionImageUrl: '',
    },
    {
      id: 'q2',
      type: 'NAT',
      topic: 'Data Structures',
      questionText: 'What is the minimum number of queues required to implement a stack?',
      questionImageUrl: '',
      options: [],
      correctAnswer: '2',
      marks: 1,
      negativeMarks: 0,
      explanation: 'Two queues are needed to simulate LIFO behavior.',
      solutionImageUrl: '',
    },
  ],
};

export function defaultNegativeForMarks(type: PscQuestionType, marks: number): number {
  if (type !== 'MCQ') return 0;
  return Math.floor((Math.max(0, Number(marks || 0)) / 3) * 100) / 100;
}

export function escapeHtml(str: string): string {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Safely formats plain text or inline HTML tags (including <u>, <b>, <i>, <strong>, <em>, <sub>, <sup>, <mark>, <br>)
 * and also unescapes previously escaped &lt;u&gt;...&lt;/u&gt; tags so underlined words always render properly.
 */
export function formatTextOrHtml(raw: string): string {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return '';

  // Including u, ins, s, strike, del, mark, p, div, span, br, ul, ol, li, pre, code, table, tr, td, th, strong, b, em, i, sub, sup, img
  if (
    /<(u|ins|s|strike|del|mark|p|div|span|br|ul|ol|li|pre|code|table|tr|td|th|strong|b|em|i|sub|sup|img)\b/i.test(
      trimmed
    )
  ) {
    return trimmed
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/\s+on[a-z]+\s*=\s*(["']).*?\1/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/<u>/gi, '<u class="underline decoration-2 underline-offset-4">');
  }

  return escapeHtml(trimmed)
    .replace(
      /&lt;u&gt;([\s\S]*?)&lt;\/u&gt;/gi,
      '<u class="underline decoration-2 underline-offset-4">$1</u>'
    )
    .replace(/&lt;(b|strong)&gt;([\s\S]*?)&lt;\/\1&gt;/gi, '<strong>$2</strong>')
    .replace(/&lt;(i|em)&gt;([\s\S]*?)&lt;\/\1&gt;/gi, '<em>$2</em>')
    .replace(/&lt;sub&gt;([\s\S]*?)&lt;\/sub&gt;/gi, '<sub>$1</sub>')
    .replace(/&lt;sup&gt;([\s\S]*?)&lt;\/sup&gt;/gi, '<sup>$1</sup>')
    .replace(/&lt;br\s*\/?&gt;/gi, '<br/>')
    .replace(/\n/g, '<br/>');
}

export function buildQuestionHtml(questionText: string, questionImageUrl?: string): string {
  const parts: string[] = [];
  const textHtml = formatTextOrHtml(questionText);
  if (textHtml) {
    parts.push(`<div class="psc-question-text">${textHtml}</div>`);
  }
  const img = String(questionImageUrl || '').trim();
  if (img) {
    parts.push(
      `<div class="psc-question-image mt-4"><img src="${escapeHtml(img)}" alt="Question Illustration" loading="lazy" class="max-w-full max-h-[420px] h-auto rounded-xl border border-white/10 object-contain" /></div>`
    );
  }
  return parts.join('');
}

export function buildOptionHtml(text: string, imageUrl?: string): string {
  const parts: string[] = [];
  const textHtml = formatTextOrHtml(text);
  if (textHtml) {
    parts.push(`<span>${textHtml}</span>`);
  }
  const img = String(imageUrl || '').trim();
  if (img) {
    parts.push(
      `<div class="mt-2"><img src="${escapeHtml(img)}" alt="Option Illustration" loading="lazy" class="max-w-full max-h-48 h-auto rounded-lg border border-white/10 object-contain" /></div>`
    );
  }
  return parts.join('');
}

export function buildSolutionHtml(explanation?: string, solutionImageUrl?: string): string {
  const exp = String(explanation || '').trim();
  const img = String(solutionImageUrl || '').trim();
  if (!exp && !img) return '';
  const parts: string[] = [];
  if (exp) {
    parts.push(
      `<div class="psc-explanation" data-raw-explanation="${encodeURIComponent(exp)}">${formatTextOrHtml(exp)}</div>`
    );
  }
  if (img) {
    parts.push(
      `<div class="psc-solution-image mt-3" data-raw-solution-image="${encodeURIComponent(img)}"><img src="${escapeHtml(img)}" alt="Solution Illustration" loading="lazy" class="max-w-full max-h-[420px] h-auto rounded-xl border border-white/10 object-contain" /></div>`
    );
  }
  return parts.join('');
}

export function extractRawSolutionFields(solutionHtml: string): {
  explanation: string;
  solutionImageUrl: string;
} {
  const raw = String(solutionHtml || '').trim();
  if (!raw) return { explanation: '', solutionImageUrl: '' };

  let explanation = '';
  let solutionImageUrl = '';

  const expMatch = raw.match(/data-raw-explanation="([^"]*)"/i);
  if (expMatch?.[1]) {
    try {
      explanation = decodeURIComponent(expMatch[1]);
    } catch {
      explanation = expMatch[1];
    }
  }

  const imgMatch = raw.match(/data-raw-solution-image="([^"]*)"/i);
  if (imgMatch?.[1]) {
    try {
      solutionImageUrl = decodeURIComponent(imgMatch[1]);
    } catch {
      solutionImageUrl = imgMatch[1];
    }
  } else {
    const fallbackImg = raw.match(/<img[^>]+src="([^"]+)"/i);
    if (fallbackImg?.[1]) solutionImageUrl = fallbackImg[1];
  }

  if (!explanation && !expMatch) {
    explanation = raw
      .replace(/<div class="psc-solution-image[\s\S]*?<\/div>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .trim();
  }

  return { explanation, solutionImageUrl };
}

export function formatPscExamName(category?: string, stream?: string): string {
  const cat = String(category || 'General').trim() || 'General';
  const st = String(stream || 'ALL').trim().toUpperCase() || 'ALL';
  return `PSC Exam • ${cat} • ${st}`;
}

export function parsePscExamMeta(testRow: any): {
  isPsc: boolean;
  category: string;
  stream: string;
  displayExamName: string;
} {
  const examName = String(testRow?.exam_name || '').trim();
  const provider = String(testRow?.provider || '').toLowerCase().trim();
  const firstQ =
    Array.isArray(testRow?.questions) && testRow.questions.length > 0
      ? testRow.questions[0]
      : null;

  if (examName.startsWith('PSC Exam •')) {
    const parts = examName.split('•').map((s: string) => s.trim());
    const category = parts[1] || testRow?.subject || testRow?.test_category || 'General';
    const stream = parts[2] || testRow?.stream || 'ALL';
    return {
      isPsc: true,
      category,
      stream: String(stream).toUpperCase(),
      displayExamName: `PSC Exam (${category})`,
    };
  }

  if (provider === 'psc' || firstQ?.pscJson) {
    const category = String(
      testRow?.subject || firstQ?.metaCategory || testRow?.test_category || 'General'
    ).trim();
    const stream = String(testRow?.stream || firstQ?.metaStream || 'ALL')
      .trim()
      .toUpperCase();
    return {
      isPsc: true,
      category,
      stream,
      displayExamName: examName || `PSC Exam (${category})`,
    };
  }

  return {
    isPsc: false,
    category: String(testRow?.subject || testRow?.test_category || 'Standard'),
    stream: String(testRow?.stream || ''),
    displayExamName: examName,
  };
}

export function parseIncomingExamJson(raw: any): PscExamPaper {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Invalid JSON structure. Expected an exam object.');
  }

  const rawQuestions = Array.isArray(raw)
    ? raw
    : Array.isArray(raw.questions)
      ? raw.questions
      : [];

  if (!rawQuestions.length) {
    throw new Error('The JSON file must contain a non-empty "questions" array.');
  }

  const questions: PscQuestion[] = rawQuestions.map((q: any, idx: number) => {
    const rawType = String(q?.type || 'MCQ').trim().toUpperCase();
    const type: PscQuestionType =
      rawType === 'NAT' ? 'NAT' : rawType === 'MSQ' ? 'MSQ' : 'MCQ';

    const questionText = String(q?.questionText ?? q?.question ?? q?.questionHtml ?? '').trim();
    const questionImageUrl = String(q?.questionImageUrl ?? q?.imageUrl ?? '').trim();

    if (!questionText && !questionImageUrl) {
      throw new Error(`Question ${idx + 1} must have either questionText or questionImageUrl.`);
    }

    const rawOptions = Array.isArray(q?.options) ? q.options : [];
    const options: PscOption[] =
      type === 'NAT'
        ? []
        : rawOptions.map((o: any, oIdx: number) => ({
            id: String(o?.id ?? o?.key ?? o?.label ?? String.fromCharCode(65 + oIdx))
              .trim()
              .toUpperCase(),
            text: String(o?.text ?? o?.html ?? (typeof o === 'string' ? o : '')).trim(),
            imageUrl: String(o?.imageUrl ?? o?.image ?? '').trim(),
          }));

    const rawAnswer = Array.isArray(q?.correctAnswer)
      ? q.correctAnswer.join(',')
      : String(q?.correctAnswer ?? q?.answer ?? '').trim();

    if (!rawAnswer) {
      throw new Error(`Question ${q?.id || idx + 1} is missing "correctAnswer".`);
    }

    const correctAnswer =
      type === 'NAT' ? rawAnswer.trim() : rawAnswer.trim().toUpperCase();

    const parsedMarks = Number(q?.marks);
    const marks = Number.isFinite(parsedMarks) && parsedMarks > 0 ? parsedMarks : 1;

    const parsedNeg = Number(q?.negativeMarks);
    const negativeMarks =
      q?.negativeMarks !== undefined &&
      q?.negativeMarks !== null &&
      q?.negativeMarks !== '' &&
      Number.isFinite(parsedNeg) &&
      parsedNeg >= 0
        ? parsedNeg
        : defaultNegativeForMarks(type, marks);

    const explanation =
      q?.explanation !== undefined && q?.explanation !== null
        ? String(q.explanation).trim()
        : '';
    const solutionImageUrl =
      q?.solutionImageUrl !== undefined && q?.solutionImageUrl !== null
        ? String(q.solutionImageUrl).trim()
        : '';

    return {
      id: String(q?.id || `q${idx + 1}`).trim(),
      type,
      topic: String(q?.topic || '').trim(),
      questionText,
      questionImageUrl,
      options,
      correctAnswer,
      marks,
      negativeMarks,
      explanation,
      solutionImageUrl,
    };
  });

  const calculatedMarks = Number(
    questions.reduce((sum: number, q: PscQuestion) => sum + Number(q.marks || 0), 0).toFixed(2)
  );

  return {
    title: String(raw.title || 'PSC Mock Test').trim(),
    category: String(raw.category || 'Subject Wise').trim(),
    stream: String(raw.stream || 'CS').trim().toUpperCase(),
    durationMinutes:
      Number.isFinite(Number(raw.durationMinutes)) && Number(raw.durationMinutes) > 0
        ? Number(raw.durationMinutes)
        : 45,
    totalMarks: calculatedMarks > 0 ? calculatedMarks : Number(raw.totalMarks) || questions.length,
    questions,
  };
}

export function safeParseExamJsonText(text: string): {
  paper: PscExamPaper;
  recoveredFromTruncation: boolean;
} {
  const cleaned = String(text || '').trim();
  if (!cleaned) {
    throw new Error('JSON content is empty.');
  }

  try {
    const raw = JSON.parse(cleaned);
    return { paper: parseIncomingExamJson(raw), recoveredFromTruncation: false };
  } catch (originalErr: any) {
    let searchPos = cleaned.length;
    while (searchPos > 0) {
      const lastObjEnd = cleaned.lastIndexOf('},', searchPos - 1);
      if (lastObjEnd === -1) break;
      const candidate = cleaned.slice(0, lastObjEnd + 1) + '\n  ]\n}';
      try {
        const raw = JSON.parse(candidate);
        const paper = parseIncomingExamJson(raw);
        if (paper.questions.length > 0) {
          return { paper, recoveredFromTruncation: true };
        }
      } catch {}
      searchPos = lastObjEnd;
    }

    throw new Error(
      originalErr instanceof SyntaxError
        ? `Invalid or incomplete JSON syntax: ${originalErr.message}`
        : originalErr?.message || 'Could not parse JSON.'
    );
  }
}
