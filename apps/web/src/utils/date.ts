import type {
  Chore,
  CompletionHistory,
  DayHistory,
} from "../types/chore";

export function formatTime(time: string): string {
  if (!time) {
    return "No reminder";
  }

  const [hourString, minute] = time.split(":");
  const hour = Number(hourString);

  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;

  return `${displayHour}:${minute} ${period}`;
}

export function getCurrentTimeString(): string {
  const now = new Date();

  const hours = now.getHours().toString().padStart(2, "0");
  const minutes = now.getMinutes().toString().padStart(2, "0");

  return `${hours}:${minutes}`;
}

export function getLocalDateString(date = new Date()): string {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1)
    .toString()
    .padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function getPreviousDateString(
  dateString: string,
): string {
  const [year, month, day] = dateString.split("-").map(Number);

  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() - 1);

  return getLocalDateString(date);
}

export function createDayHistory(
  date: string,
  chores: Chore[],
): DayHistory {
  const completedCount = chores.filter(
    (chore) => chore.completed,
  ).length;

  const totalCount = chores.length;

  return {
    date,
    completedCount,
    totalCount,
    allCompleted:
      totalCount > 0 && completedCount === totalCount,
  };
}

export function calculateCurrentStreak(
  history: CompletionHistory,
  chores: Chore[],
): number {
  const today = getLocalDateString();

  const combinedHistory: CompletionHistory = {
    ...history,
    [today]: createDayHistory(today, chores),
  };

  let dateToCheck = today;

  if (!combinedHistory[today]?.allCompleted) {
    dateToCheck = getPreviousDateString(today);
  }

  let streak = 0;

  while (combinedHistory[dateToCheck]?.allCompleted) {
    streak += 1;
    dateToCheck = getPreviousDateString(dateToCheck);
  }

  return streak;
}