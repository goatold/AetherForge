export interface ScheduleInput {
  recallScore: number;
  easeFactor: number;
  intervalDays: number;
  repetitionCount: number;
  now?: Date;
}

export interface ScheduleResult {
  easeFactor: number;
  intervalDays: number;
  repetitionCount: number;
  nextReviewAt: Date;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const toTwoDecimals = (value: number) => Number(value.toFixed(2));

// SM-2-style scheduling tuned for a simple MVP queue.
export const scheduleNextReview = (input: ScheduleInput): ScheduleResult => {
  const score = clamp(input.recallScore, 0, 5);
  const now = input.now ?? new Date();
  const previousEase = clamp(input.easeFactor, 1.3, 3.5);
  const previousInterval = Math.max(0, Math.round(input.intervalDays));
  const previousRepetition = Math.max(0, Math.round(input.repetitionCount));

  const penalty = 5 - score;
  const nextEase = clamp(
    previousEase + (0.1 - penalty * (0.08 + penalty * 0.02)),
    1.3,
    3.5
  );

  if (score < 3) {
    const nextReviewAt = new Date(now);
    nextReviewAt.setDate(nextReviewAt.getDate() + 1);
    return {
      easeFactor: toTwoDecimals(nextEase),
      intervalDays: 1,
      repetitionCount: 0,
      nextReviewAt
    };
  }

  const repetitionCount = previousRepetition + 1;
  let intervalDays = 1;
  if (repetitionCount === 2) {
    intervalDays = 3;
  } else if (repetitionCount > 2) {
    intervalDays = Math.max(1, Math.round(previousInterval * nextEase));
  }

  const nextReviewAt = new Date(now);
  nextReviewAt.setDate(nextReviewAt.getDate() + intervalDays);

  return {
    easeFactor: toTwoDecimals(nextEase),
    intervalDays,
    repetitionCount,
    nextReviewAt
  };
};
