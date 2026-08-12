import {
  apiRequest,
} from "./client";

import type {
  CompletionHistory,
  DayHistory,
} from "../types/chore";

import type {
  ProgressDayApiResponse,
  ProgressHistory,
  ProgressHistoryApiResponse,
} from "../types/progress";


function mapProgressDay(
  day: ProgressDayApiResponse,
): DayHistory {
  return {
    date: day.progress_date,
    totalCount: day.total_count,
    completedCount:
      day.completed_count,
    allCompleted:
      day.all_completed,
  };
}


function mapProgressHistory(
  response:
    ProgressHistoryApiResponse,
): ProgressHistory {
  const history =
    response.history.reduce<
      CompletionHistory
    >(
      (
        currentHistory,
        day,
      ) => {
        currentHistory[
          day.progress_date
        ] = mapProgressDay(
          day,
        );

        return currentHistory;
      },
      {},
    );

  return {
    history,
    currentStreak:
      response.current_streak,
    longestStreak:
      response.longest_streak,
    perfectDays:
      response.perfect_days,
    averageCompletion:
      response.average_completion,
    recordedDays:
      response.recorded_days,
  };
}


export async function getProgressHistory(
  days = 365,
): Promise<ProgressHistory> {
  const response =
    await apiRequest<
      ProgressHistoryApiResponse
    >(
      (
        "/api/v1/progress/"
        + `history?days=${days}`
      ),
    );

  return mapProgressHistory(
    response,
  );
}


export async function saveProgressSnapshot(
  snapshot: DayHistory,
): Promise<DayHistory> {
  const response =
    await apiRequest<
      ProgressDayApiResponse
    >(
      "/api/v1/progress/snapshot",
      {
        method: "PUT",
        body: JSON.stringify({
          progress_date:
            snapshot.date,
          total_count:
            snapshot.totalCount,
          completed_count:
            snapshot.completedCount,
        }),
      },
    );

  return mapProgressDay(
    response,
  );
}


export async function importProgressHistory(
  history: CompletionHistory,
): Promise<ProgressHistory> {
  const response =
    await apiRequest<
      ProgressHistoryApiResponse
    >(
      "/api/v1/progress/import",
      {
        method: "POST",
        body: JSON.stringify({
          snapshots:
            Object.values(
              history,
            ).map(
              (day) => ({
                progress_date:
                  day.date,
                total_count:
                  day.totalCount,
                completed_count:
                  day.completedCount,
              }),
            ),
        }),
      },
    );

  return mapProgressHistory(
    response,
  );
}
