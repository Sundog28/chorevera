import type {
  CompletionHistory,
  DayHistory,
} from "./chore";


export type ProgressDayApiResponse = {
  progress_date: string;
  total_count: number;
  completed_count: number;
  all_completed: boolean;
  updated_at: string;
};


export type ProgressHistoryApiResponse = {
  history:
    ProgressDayApiResponse[];

  current_streak: number;
  longest_streak: number;
  perfect_days: number;
  average_completion: number;
  recorded_days: number;
};


export type ProgressHistory = {
  history: CompletionHistory;
  currentStreak: number;
  longestStreak: number;
  perfectDays: number;
  averageCompletion: number;
  recordedDays: number;
};


export type {
  CompletionHistory,
  DayHistory,
};
