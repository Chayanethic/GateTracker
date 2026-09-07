export type TestQuestion = {
  id: string;
  number: number;
  type: 'MCQ' | 'MSQ' | 'NAT';
  questionHtml: string;
  options: { key: string; html: string }[];
  answer: string[];
  solutionHtml: string;
  videoUrl?: string;
};

export type TestSeries = {
  id: string;
  title: string;
  exam_name: string;
  duration_minutes: number;
  max_marks: number;
  question_count: number;
  questions: TestQuestion[];
};
