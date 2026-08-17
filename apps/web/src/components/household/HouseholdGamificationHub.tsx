import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Award,
  Scale,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Crown,
  Lightbulb,
  Medal,
  PartyPopper,
  Sparkles,
  Target,
  Trophy,
  UserRound,
} from "lucide-react";

import {
  autoAssignChores,
  getChores,
  previewAutoAssignChores,
  type AutoAssignMode,
  type ChoreAutoAssignResponse,
} from "../../api/chores";

import type {
  Chore,
  CompletionHistory,
} from "../../types/chore";

import type {
  Household,
} from "../../types/household";


type MemberProgressItem = {
  member: Household["members"][number];
  assignedCount: number;
  completedCount: number;
  remainingCount: number;
  percentage: number;
};


type HouseholdGamificationHubProps = {
  household: Household;
  householdChores: Chore[];
  memberProgress: MemberProgressItem[];
  householdCompletionPercentage: number;
  householdCompletedCount: number;
  householdRemainingCount: number;
  completionHistory: CompletionHistory;

  isHouseholdOwner: boolean;

  onChoresUpdated:
    (chores: Chore[]) => void;
};


type BadgeDefinition = {
  icon: string;
  title: string;
  description: string;
  unlocked: boolean;
};


function formatMonth(
  value: Date,
): string {
  return value.toLocaleDateString(
    undefined,
    {
      month: "long",
      year: "numeric",
    },
  );
}


function getMonthGrid(
  activeMonth: Date,
): Array<number | null> {
  const year =
    activeMonth.getFullYear();

  const month =
    activeMonth.getMonth();

  const firstWeekday =
    new Date(
      year,
      month,
      1,
    ).getDay();

  const totalDays =
    new Date(
      year,
      month + 1,
      0,
    ).getDate();

  const cells:
    Array<number | null> = [];

  for (
    let index = 0;
    index < firstWeekday;
    index += 1
  ) {
    cells.push(null);
  }

  for (
    let day = 1;
    day <= totalDays;
    day += 1
  ) {
    cells.push(day);
  }

  while (
    cells.length % 7 !== 0
  ) {
    cells.push(null);
  }

  return cells;
}



type WeeklyChartDay = {
  dateKey: string;
  weekday: string;
  dateLabel: string;
  percentage: number;
  completedCount: number;
  totalCount: number;
  isToday: boolean;
  hasData: boolean;
};


type AchievementUnlock = {
  memberName: string;
  icon: string;
  title: string;
  description: string;
};


function toLocalDateKey(
  value: Date,
): string {
  const year =
    value.getFullYear();

  const month =
    String(
      value.getMonth() + 1,
    ).padStart(
      2,
      "0",
    );

  const day =
    String(
      value.getDate(),
    ).padStart(
      2,
      "0",
    );

  return `${year}-${month}-${day}`;
}


function buildWeeklyChartDays(
  completionHistory: CompletionHistory,
): WeeklyChartDay[] {
  const today =
    new Date();

  return Array.from(
    {
      length: 7,
    },
    (_, index) => {
      const date =
        new Date(
          today.getFullYear(),
          today.getMonth(),
          today.getDate() -
            (6 - index),
        );

      const dateKey =
        toLocalDateKey(
          date,
        );

      const historyDay =
        completionHistory[
          dateKey
        ];

      const totalCount =
        historyDay?.totalCount ??
        0;

      const completedCount =
        historyDay?.completedCount ??
        0;

      const percentage =
        totalCount === 0
          ? 0
          : Math.round(
              (
                completedCount /
                totalCount
              ) * 100,
            );

      return {
        dateKey,
        weekday:
          date.toLocaleDateString(
            undefined,
            {
              weekday: "short",
            },
          ),
        dateLabel:
          date.toLocaleDateString(
            undefined,
            {
              month: "short",
              day: "numeric",
            },
          ),
        percentage,
        completedCount,
        totalCount,
        isToday:
          dateKey ===
          toLocalDateKey(
            today,
          ),
        hasData:
          totalCount > 0,
      };
    },
  );
}



type AnalyticsRange =
  | "7d"
  | "30d";


type AnalyticsDay = {
  dateKey: string;
  date: Date;
  percentage: number;
  completedCount: number;
  totalCount: number;
  hasData: boolean;
};


function buildAnalyticsDays(
  completionHistory: CompletionHistory,
  dayCount: number,
): AnalyticsDay[] {
  const today = new Date();

  return Array.from(
    { length: dayCount },
    (_, index) => {
      const date = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate() -
          (dayCount - 1 - index),
      );

      const dateKey =
        toLocalDateKey(date);

      const historyDay =
        completionHistory[dateKey];

      const totalCount =
        historyDay?.totalCount ?? 0;

      const completedCount =
        historyDay?.completedCount ?? 0;

      return {
        dateKey,
        date,
        totalCount,
        completedCount,
        hasData: totalCount > 0,
        percentage:
          totalCount === 0
            ? 0
            : Math.round(
                (completedCount / totalCount) * 100,
              ),
      };
    },
  );
}


function buildLinePath(
  values: number[],
  width: number,
  height: number,
): string {
  if (values.length === 0) {
    return "";
  }

  const horizontalStep =
    values.length === 1
      ? 0
      : width / (values.length - 1);

  return values
    .map((value, index) => {
      const x = index * horizontalStep;
      const y =
        height -
        (Math.max(0, Math.min(100, value)) / 100) * height;

      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}


export default function HouseholdGamificationHub({
  household,
  householdChores,
  memberProgress,
  householdCompletionPercentage,
  householdCompletedCount,
  householdRemainingCount,
  completionHistory,
  isHouseholdOwner,
  onChoresUpdated,
}: HouseholdGamificationHubProps) {
  const [
    activeMonth,
    setActiveMonth,
  ] = useState(
    () => new Date(),
  );

  const [
    celebrationDismissed,
    setCelebrationDismissed,
  ] = useState(false);

  const [
    autoAssignMode,
    setAutoAssignMode,
  ] = useState<AutoAssignMode>(
    "unassigned_only",
  );

  const [
    autoAssignPreview,
    setAutoAssignPreview,
  ] = useState<
    ChoreAutoAssignResponse | null
  >(null);

  const [
    isPreviewingAssignments,
    setIsPreviewingAssignments,
  ] = useState(false);

  const [
    isApplyingAssignments,
    setIsApplyingAssignments,
  ] = useState(false);

  const [
    autoAssignError,
    setAutoAssignError,
  ] = useState("");

  const [
    autoAssignMessage,
    setAutoAssignMessage,
  ] = useState("");

  const [
    chartAnimationReady,
    setChartAnimationReady,
  ] = useState(false);

  const [
    analyticsRange,
    setAnalyticsRange,
  ] = useState<AnalyticsRange>(
    "30d",
  );

  const [
    achievementUnlock,
    setAchievementUnlock,
  ] = useState<
    AchievementUnlock | null
  >(null);

  const today = new Date();

  const leaderboard =
    useMemo(
      () =>
        memberProgress
          .map((item) => ({
            ...item,
            points:
              item.completedCount * 10,
          }))
          .sort(
            (first, second) =>
              second.points -
                first.points ||
              second.percentage -
                first.percentage ||
              first.member.name.localeCompare(
                second.member.name,
              ),
          ),
      [memberProgress],
    );

  const champion =
    leaderboard.find(
      (item) =>
        item.assignedCount > 0,
    ) ?? leaderboard[0] ?? null;

  const mostReliable =
    [...leaderboard]
      .filter(
        (item) =>
          item.assignedCount > 0,
      )
      .sort(
        (first, second) =>
          second.percentage -
            first.percentage ||
          second.completedCount -
            first.completedCount,
      )[0] ?? null;

  const needsHelp =
    [...leaderboard]
      .filter(
        (item) =>
          item.remainingCount > 0,
      )
      .sort(
        (first, second) =>
          second.remainingCount -
            first.remainingCount ||
          first.percentage -
            second.percentage,
      )[0] ?? null;

  const householdHealth =
    householdChores.length === 0
      ? 0
      : Math.round(
          (
            householdCompletedCount /
            householdChores.length
          ) * 100,
        );

  const coachMessages =
    useMemo(() => {
      const messages: string[] = [];

      if (
        householdChores.length === 0
      ) {
        messages.push(
          "Create and assign a household chore to begin receiving smart coaching insights.",
        );

        return messages;
      }

      if (
        householdCompletionPercentage ===
        100
      ) {
        messages.push(
          "The household is fully caught up. This is a good time to celebrate the team.",
        );
      } else if (
        householdCompletionPercentage >=
        70
      ) {
        messages.push(
          `The household is ${householdCompletionPercentage}% complete. A final reminder could help everyone finish strong.`,
        );
      } else if (
        householdCompletionPercentage <
        40
      ) {
        messages.push(
          "Household progress is below 40%. Consider reducing the workload or reassigning unfinished chores.",
        );
      }

      if (needsHelp) {
        messages.push(
          `${needsHelp.member.name} has ${needsHelp.remainingCount} unfinished ${
            needsHelp.remainingCount === 1
              ? "chore"
              : "chores"
          }. A check-in or reassignment may help.`,
        );
      }

      if (
        mostReliable &&
        mostReliable.percentage === 100
      ) {
        messages.push(
          `${mostReliable.member.name} has completed every assigned chore and deserves recognition.`,
        );
      }

      const unassignedCount =
        householdChores.filter(
          (chore) =>
            chore.assignedUserId ===
            null,
        ).length;

      if (unassignedCount > 0) {
        messages.push(
          `${unassignedCount} household ${
            unassignedCount === 1
              ? "chore is"
              : "chores are"
          } unassigned. Assigning them will make progress tracking more accurate.`,
        );
      }

      return messages.slice(
        0,
        3,
      );
    }, [
      householdChores,
      householdCompletionPercentage,
      mostReliable,
      needsHelp,
    ]);

  const badgesByMember =
    useMemo(
      () =>
        leaderboard.map(
          (item) => {
            const badges:
              BadgeDefinition[] = [
              {
                icon: "ðŸ†",
                title:
                  "Chore Champion",
                description:
                  "Complete 10 household chores.",
                unlocked:
                  item.completedCount >=
                  10,
              },
              {
                icon: "â­",
                title:
                  "Perfect Finish",
                description:
                  "Complete every assigned chore.",
                unlocked:
                  item.assignedCount > 0 &&
                  item.percentage === 100,
              },
              {
                icon: "âš¡",
                title:
                  "Fast Starter",
                description:
                  "Complete at least three chores.",
                unlocked:
                  item.completedCount >=
                  3,
              },
              {
                icon: "ðŸ‘‘",
                title:
                  "Household Hero",
                description:
                  "Reach first place on the leaderboard.",
                unlocked:
                  champion?.member.user_id ===
                    item.member.user_id &&
                  item.points > 0,
              },
            ];

            return {
              ...item,
              badges,
            };
          },
        ),
      [
        leaderboard,
        champion,
      ],
    );

  const monthCells =
    useMemo(
      () =>
        getMonthGrid(
          activeMonth,
        ),
      [activeMonth],
    );

  const choresByTime =
    useMemo(
      () =>
        [...householdChores].sort(
          (first, second) =>
            (
              first.reminderTime ??
              ""
            ).localeCompare(
              second.reminderTime ??
                "",
            ),
        ),
      [householdChores],
    );

  const weeklyChartDays =
    useMemo(
      () =>
        buildWeeklyChartDays(
          completionHistory,
        ),
      [completionHistory],
    );

  const weeklyAverage =
    useMemo(() => {
      const measurableDays =
        weeklyChartDays.filter(
          (day) =>
            day.hasData,
        );

      if (
        measurableDays.length ===
        0
      ) {
        return 0;
      }

      return Math.round(
        measurableDays.reduce(
          (total, day) =>
            total +
            day.percentage,
          0,
        ) /
          measurableDays.length,
      );
    }, [weeklyChartDays]);

  const bestWeekday =
    useMemo(
      () =>
        [...weeklyChartDays]
          .filter(
            (day) =>
              day.hasData,
          )
          .sort(
            (first, second) =>
              second.percentage -
                first.percentage ||
              second.completedCount -
                first.completedCount,
          )[0] ?? null,
      [weeklyChartDays],
    );

  const analyticsDays =
    useMemo(
      () =>
        buildAnalyticsDays(
          completionHistory,
          analyticsRange === "7d"
            ? 7
            : 30,
        ),
      [analyticsRange, completionHistory],
    );

  const measurableAnalyticsDays =
    useMemo(
      () =>
        analyticsDays.filter(
          (day) => day.hasData,
        ),
      [analyticsDays],
    );

  const analyticsAverage =
    useMemo(() => {
      if (measurableAnalyticsDays.length === 0) {
        return 0;
      }

      return Math.round(
        measurableAnalyticsDays.reduce(
          (sum, day) => sum + day.percentage,
          0,
        ) / measurableAnalyticsDays.length,
      );
    }, [measurableAnalyticsDays]);

  const analyticsPerfectDays =
    useMemo(
      () =>
        measurableAnalyticsDays.filter(
          (day) => day.percentage === 100,
        ).length,
      [measurableAnalyticsDays],
    );

  const analyticsTotalCompleted =
    useMemo(
      () =>
        analyticsDays.reduce(
          (sum, day) => sum + day.completedCount,
          0,
        ),
      [analyticsDays],
    );

  const analyticsLinePath =
    useMemo(
      () =>
        buildLinePath(
          analyticsDays.map((day) => day.percentage),
          720,
          220,
        ),
      [analyticsDays],
    );

  const workloadTotal =
    useMemo(
      () =>
        memberProgress.reduce(
          (sum, item) => sum + item.assignedCount,
          0,
        ),
      [memberProgress],
    );

  const completedShare =
    householdChores.length === 0
      ? 0
      : Math.round(
          (householdCompletedCount /
            householdChores.length) * 100,
        );

  const showCelebration =
    householdChores.length > 0 &&
    householdCompletionPercentage ===
      100 &&
    !celebrationDismissed;

  useEffect(() => {
    if (
      householdCompletionPercentage <
      100
    ) {
      setCelebrationDismissed(
        false,
      );
    }
  }, [
    householdCompletionPercentage,
  ]);

  useEffect(() => {
    const animationFrame =
      window.requestAnimationFrame(
        () => {
          setChartAnimationReady(
            true,
          );
        },
      );

    return () => {
      window.cancelAnimationFrame(
        animationFrame,
      );
    };
  }, []);

  useEffect(() => {
    const storageKey =
      `choreflow-achievements-${household.id}`;

    const unlockedAchievements =
      badgesByMember.flatMap(
        ({
          member,
          badges,
        }) =>
          badges
            .filter(
              (badge) =>
                badge.unlocked,
            )
            .map(
              (badge) => ({
                key:
                  `${member.user_id}:` +
                  `${badge.title}`,
                memberName:
                  member.name,
                ...badge,
              }),
            ),
      );

    const currentKeys =
      unlockedAchievements.map(
        (achievement) =>
          achievement.key,
      );

    const storedValue =
      localStorage.getItem(
        storageKey,
      );

    if (storedValue === null) {
      localStorage.setItem(
        storageKey,
        JSON.stringify(
          currentKeys,
        ),
      );

      return;
    }

    let previousKeys:
      string[] = [];

    try {
      previousKeys =
        JSON.parse(
          storedValue,
        ) as string[];
    } catch {
      previousKeys = [];
    }

    const previousKeySet =
      new Set(
        previousKeys,
      );

    const newlyUnlocked =
      unlockedAchievements.find(
        (achievement) =>
          !previousKeySet.has(
            achievement.key,
          ),
      );

    localStorage.setItem(
      storageKey,
      JSON.stringify(
        currentKeys,
      ),
    );

    if (newlyUnlocked) {
      setAchievementUnlock({
        memberName:
          newlyUnlocked.memberName,
        icon:
          newlyUnlocked.icon,
        title:
          newlyUnlocked.title,
        description:
          newlyUnlocked.description,
      });
    }
  }, [
    badgesByMember,
    household.id,
  ]);

  async function handlePreviewAssignments():
  Promise<void> {
    if (
      !isHouseholdOwner ||
      isPreviewingAssignments
    ) {
      return;
    }

    setIsPreviewingAssignments(
      true,
    );
    setAutoAssignError("");
    setAutoAssignMessage("");

    try {
      const preview =
        await previewAutoAssignChores(
          household.id,
          autoAssignMode,
        );

      setAutoAssignPreview(
        preview,
      );

      if (
        preview.eligible_chore_count ===
        0
      ) {
        setAutoAssignMessage(
          autoAssignMode ===
            "unassigned_only"
            ? (
                "There are no unassigned incomplete chores. Choose rebalance incomplete chores to redistribute the current workload."
              )
            : (
                "There are no incomplete household chores to rebalance."
              ),
        );
      }
    } catch (error) {
      setAutoAssignError(
        error instanceof Error
          ? error.message
          : (
              "Unable to preview automatic assignments."
            ),
      );
    } finally {
      setIsPreviewingAssignments(
        false,
      );
    }
  }


  async function handleApplyAssignments():
  Promise<void> {
    if (
      !isHouseholdOwner ||
      isApplyingAssignments
    ) {
      return;
    }

    setIsApplyingAssignments(
      true,
    );
    setAutoAssignError("");
    setAutoAssignMessage("");

    try {
      const result =
        await autoAssignChores(
          household.id,
          autoAssignMode,
        );

      const refreshedChores =
        await getChores({
          scope: "all",
        });

      onChoresUpdated(
        refreshedChores,
      );

      setAutoAssignPreview(
        result,
      );

      setAutoAssignMessage(
        result.changed_chore_count === 0
          ? (
              "The workload is already balanced for the selected mode."
            )
          : (
              `${result.changed_chore_count} ${
                result.changed_chore_count === 1
                  ? "chore was"
                  : "chores were"
              } assigned successfully.`
            ),
      );
    } catch (error) {
      setAutoAssignError(
        error instanceof Error
          ? error.message
          : (
              "Unable to apply automatic assignments."
            ),
      );
    } finally {
      setIsApplyingAssignments(
        false,
      );
    }
  }


  function changeMonth(
    offset: number,
  ): void {
    setActiveMonth(
      (currentMonth) =>
        new Date(
          currentMonth.getFullYear(),
          currentMonth.getMonth() +
            offset,
          1,
        ),
    );
  }

  return (
    <>
      {achievementUnlock && (
        <div
          aria-labelledby="achievement-unlock-title"
          aria-modal="true"
          className="achievement-unlock-backdrop"
          role="dialog"
        >
          <div className="achievement-unlock-modal">
            <div className="achievement-unlock-burst">
              {Array.from({
                length: 14,
              }).map((_, index) => (
                <span
                  key={index}
                  style={{
                    transform:
                      `rotate(${index * 25.7}deg)`,
                  }}
                />
              ))}
            </div>

            <div className="achievement-unlock-icon">
              {achievementUnlock.icon}
            </div>

            <span className="eyebrow">
              Badge unlocked
            </span>

            <h3 id="achievement-unlock-title">
              {achievementUnlock.title}
            </h3>

            <p>
              {achievementUnlock.memberName}
              {" — "}
              {achievementUnlock.description}
            </p>

            <button
              className="primary-button"
              onClick={() =>
                setAchievementUnlock(
                  null,
                )
              }
              type="button"
            >
              Awesome!
            </button>
          </div>
        </div>
      )}

      {showCelebration && (
        <div
          className="household-celebration"
          role="status"
        >
          <div className="celebration-confetti">
            {Array.from({
              length: 18,
            }).map((_, index) => (
              <span
                key={index}
                style={{
                  animationDelay:
                    `${index * 70}ms`,
                  left:
                    `${(index * 37) % 100}%`,
                }}
              />
            ))}
          </div>

          <PartyPopper size={36} />

          <div>
            <strong>
              Household complete!
            </strong>

            <span>
              Every assigned chore is
              finished. Great teamwork.
            </span>
          </div>

          <button
            onClick={() =>
              setCelebrationDismissed(
                true,
              )
            }
            type="button"
          >
            Dismiss
          </button>
        </div>
      )}

      <section
        className="smart-assignment-panel"
        id="smart-assignment-panel"
      >
        <div className="command-section-heading">
          <div>
            <span className="eyebrow">
              Smart automation
            </span>

            <h4>
              Fair chore assignment
            </h4>
          </div>

          <Scale size={22} />
        </div>

        {!isHouseholdOwner ? (
          <div className="automation-locked-note">
            Only the household owner can
            preview or apply automatic
            assignments.
          </div>
        ) : (
          <>
            <p className="automation-description">
              Chorevera distributes incomplete
              household chores to the members
              with the lightest current workload.
              Review the plan before applying it.
            </p>

            <div className="automation-mode-grid">
              <button
                className={
                  autoAssignMode ===
                  "unassigned_only"
                    ? "selected"
                    : ""
                }
                onClick={() => {
                  setAutoAssignMode(
                    "unassigned_only",
                  );
                  setAutoAssignPreview(
                    null,
                  );
                  setAutoAssignMessage(
                    "",
                  );
                }}
                type="button"
              >
                <strong>
                  Assign unassigned chores
                </strong>

                <span>
                  Keep existing assignments and
                  distribute only chores with no
                  assignee.
                </span>
              </button>

              <button
                className={
                  autoAssignMode ===
                  "rebalance_incomplete"
                    ? "selected"
                    : ""
                }
                onClick={() => {
                  setAutoAssignMode(
                    "rebalance_incomplete",
                  );
                  setAutoAssignPreview(
                    null,
                  );
                  setAutoAssignMessage(
                    "",
                  );
                }}
                type="button"
              >
                <strong>
                  Rebalance incomplete chores
                </strong>

                <span>
                  Redistribute every unfinished
                  household chore as evenly as
                  possible.
                </span>
              </button>
            </div>

            <div className="automation-actions">
              <button
                className="secondary-button"
                disabled={
                  isPreviewingAssignments ||
                  isApplyingAssignments
                }
                onClick={() => {
                  void handlePreviewAssignments();
                }}
                type="button"
              >
                {isPreviewingAssignments
                  ? "Building preview..."
                  : "Preview assignments"}
              </button>

              <button
                className="primary-button"
                disabled={
                  isPreviewingAssignments ||
                  isApplyingAssignments ||
                  !autoAssignPreview ||
                  autoAssignPreview
                    .eligible_chore_count === 0
                }
                onClick={() => {
                  void handleApplyAssignments();
                }}
                type="button"
              >
                {isApplyingAssignments
                  ? "Applying..."
                  : "Apply fair assignments"}
              </button>
            </div>

            {autoAssignError && (
              <div className="automation-feedback error">
                {autoAssignError}
              </div>
            )}

            {autoAssignMessage && (
              <div className="automation-feedback success">
                {autoAssignMessage}
              </div>
            )}

            {autoAssignPreview &&
              autoAssignPreview
                .eligible_chore_count > 0 && (
              <div className="assignment-preview">
                <div className="assignment-preview-heading">
                  <strong>
                    Assignment preview
                  </strong>

                  <span>
                    {
                      autoAssignPreview
                        .changed_chore_count
                    }{" "}
                    changes
                  </span>
                </div>

                <div className="assignment-preview-list">
                  {autoAssignPreview
                    .assignments.map(
                      (assignment) => (
                        <article
                          key={
                            assignment.chore_id
                          }
                        >
                          <div>
                            <strong>
                              {
                                assignment
                                  .chore_title
                              }
                            </strong>

                            <span>
                              Assigned to{" "}
                              {
                                assignment
                                  .assigned_user_name
                              }
                            </span>
                          </div>

                          <span
                            className={
                              assignment.changed
                                ? "changed"
                                : "unchanged"
                            }
                          >
                            {assignment.changed
                              ? "Change"
                              : "No change"}
                          </span>
                        </article>
                      ),
                    )}
                </div>
              </div>
            )}
          </>
        )}
      </section>

      <section className="weekly-winner-card">
        <div className="weekly-winner-icon">
          <Crown size={29} />
        </div>

        <div className="weekly-winner-copy">
          <span className="eyebrow">
            Weekly champion
          </span>

          <h4>
            {champion
              ? champion.member.name
              : "No champion yet"}
          </h4>

          <p>
            {champion &&
            champion.assignedCount > 0
              ? (
                  `${champion.points} points Â· ` +
                  `${champion.completedCount} completed`
                )
              : (
                  "Complete household chores to claim first place."
                )}
          </p>
        </div>

        <div className="weekly-winner-score">
          <Trophy size={22} />

          <strong>
            {champion?.points ??
              0}
          </strong>

          <span>points</span>
        </div>
      </section>

      <section className="parent-dashboard">
        <div className="command-section-heading">
          <div>
            <span className="eyebrow">
              Parent dashboard
            </span>

            <h4>
              Household health
            </h4>
          </div>

          <Target size={21} />
        </div>

        <div className="parent-dashboard-grid">
          <article>
            <div className="parent-metric-icon">
              <BarChart3 size={19} />
            </div>

            <span>
              Household health
            </span>

            <strong>
              {householdHealth}%
            </strong>

            <p>
              {householdHealth >= 80
                ? "Everyone is on schedule."
                : "A few assignments need attention."}
            </p>
          </article>

          <article>
            <div className="parent-metric-icon warning">
              <Target size={19} />
            </div>

            <span>
              Unfinished chores
            </span>

            <strong>
              {householdRemainingCount}
            </strong>

            <p>
              Across all household members.
            </p>
          </article>

          <article>
            <div className="parent-metric-icon success">
              <Medal size={19} />
            </div>

            <span>
              Most reliable
            </span>

            <strong>
              {mostReliable?.member.name ??
                "No data"}
            </strong>

            <p>
              {mostReliable
                ? `${mostReliable.percentage}% complete`
                : "Assign chores to compare progress."}
            </p>
          </article>

          <article>
            <div className="parent-metric-icon attention">
              <UserRound size={19} />
            </div>

            <span>
              Needs support
            </span>

            <strong>
              {needsHelp?.member.name ??
                "Nobody"}
            </strong>

            <p>
              {needsHelp
                ? `${needsHelp.remainingCount} remaining`
                : "The household is caught up."}
            </p>
          </article>
        </div>
      </section>

      <section className="household-leaderboard">
        <div className="command-section-heading">
          <div>
            <span className="eyebrow">
              Friendly competition
            </span>

            <h4>
              Household leaderboard
            </h4>
          </div>

          <Trophy size={21} />
        </div>

        {leaderboard.length === 0 ? (
          <div className="leaderboard-empty-state">
            <Trophy size={30} />

            <strong>
              No leaderboard activity yet
            </strong>

            <span>
              Complete household chores to
              start earning points.
            </span>
          </div>
        ) : (
          <div className="household-leaderboard-list">
            {leaderboard.map(
              (
                {
                  member,
                  completedCount,
                  assignedCount,
                  percentage,
                  points,
                },
                index,
              ) => {
                const position =
                  index + 1;

                const rankLabel =
                  position === 1
                    ? "ðŸ¥‡"
                    : position === 2
                      ? "ðŸ¥ˆ"
                      : position === 3
                        ? "ðŸ¥‰"
                        : `#${position}`;

                return (
                  <article
                    className={
                      `household-leaderboard-item ` +
                      `${
                        position === 1
                          ? "leader"
                          : ""
                      }`
                    }
                    key={member.user_id}
                  >
                    <div className="leaderboard-rank">
                      {rankLabel}
                    </div>

                    <div className="leaderboard-member">
                      <div className="leaderboard-avatar">
                        <UserRound size={18} />
                      </div>

                      <div>
                        <strong>
                          {member.name}
                        </strong>

                        <span>
                          {completedCount}/
                          {assignedCount} completed
                        </span>
                      </div>
                    </div>

                    <div className="leaderboard-progress">
                      <div className="command-progress-track">
                        <div
                          style={{
                            width:
                              `${percentage}%`,
                          }}
                        />
                      </div>

                      <span>
                        {percentage}% complete
                      </span>
                    </div>

                    <div className="leaderboard-points">
                      <strong>
                        {points}
                      </strong>

                      <span>points</span>
                    </div>
                  </article>
                );
              },
            )}
          </div>
        )}

        <p className="leaderboard-note">
          Each completed household chore
          earns 10 points.
        </p>
      </section>

      <section className="achievement-section">
        <div className="command-section-heading">
          <div>
            <span className="eyebrow">
              Achievements
            </span>

            <h4>
              Family badges
            </h4>
          </div>

          <Award size={21} />
        </div>

        <div className="achievement-member-list">
          {badgesByMember.map(
            ({
              member,
              badges,
            }) => (
              <article
                className="achievement-member-card"
                key={member.user_id}
              >
                <div className="achievement-member-heading">
                  <div className="leaderboard-avatar">
                    <UserRound size={18} />
                  </div>

                  <strong>
                    {member.name}
                  </strong>
                </div>

                <div className="achievement-badge-grid">
                  {badges.map(
                    (badge) => (
                      <div
                        className={
                          `achievement-badge ` +
                          `${
                            badge.unlocked
                              ? "unlocked"
                              : "locked"
                          }`
                        }
                        key={badge.title}
                        title={
                          badge.description
                        }
                      >
                        <span>
                          {badge.icon}
                        </span>

                        <div>
                          <strong>
                            {badge.title}
                          </strong>

                          <small>
                            {badge.unlocked
                              ? "Unlocked"
                              : badge.description}
                          </small>
                        </div>
                      </div>
                    ),
                  )}
                </div>
              </article>
            ),
          )}
        </div>
      </section>

      <section className="weekly-chart-section">
        <div className="command-section-heading">
          <div>
            <span className="eyebrow">
              Weekly overview
            </span>

            <h4>
              Last seven days
            </h4>
          </div>

          <BarChart3 size={21} />
        </div>

        <div className="weekly-chart-summary">
          <article>
            <span>
              Weekly average
            </span>

            <strong>
              {weeklyAverage}%
            </strong>
          </article>

          <article>
            <span>
              Best day
            </span>

            <strong>
              {bestWeekday
                ? (
                    `${bestWeekday.weekday} ` +
                    `${bestWeekday.percentage}%`
                  )
                : "No data"}
            </strong>
          </article>

          <article>
            <span>
              Recorded days
            </span>

            <strong>
              {
                weeklyChartDays.filter(
                  (day) =>
                    day.hasData,
                ).length
              }
              /7
            </strong>
          </article>
        </div>

        <div className="weekly-chart real-history-chart">
          {weeklyChartDays.map(
            (day) => (
              <div
                className={
                  `weekly-chart-column ` +
                  `${
                    day.isToday
                      ? "today"
                      : ""
                  }`
                }
                key={day.dateKey}
                title={
                  day.hasData
                    ? (
                        `${day.dateLabel}: ` +
                        `${day.completedCount}/` +
                        `${day.totalCount} completed ` +
                        `(${day.percentage}%)`
                      )
                    : (
                        `${day.dateLabel}: No recorded chores`
                      )
                }
              >
                <div className="weekly-chart-value">
                  {day.hasData
                    ? `${day.percentage}%`
                    : "—"}
                </div>

                <div className="weekly-chart-track">
                  <div
                    className={
                      day.hasData
                        ? ""
                        : "no-data"
                    }
                    style={{
                      height:
                        chartAnimationReady
                          ? (
                              day.hasData
                                ? `${Math.max(
                                    day.percentage,
                                    4,
                                  )}%`
                                : "0%"
                            )
                          : "0%",
                    }}
                  />
                </div>

                <strong>
                  {day.weekday}
                </strong>

                <span>
                  {day.dateLabel}
                </span>

                {day.isToday && (
                  <small>
                    Today
                  </small>
                )}
              </div>
            ),
          )}
        </div>

        {weeklyChartDays.every(
          (day) =>
            !day.hasData,
        ) && (
          <div className="weekly-chart-empty">
            Complete chores over the next
            few days to build your weekly
            trend.
          </div>
        )}

        <p className="gamification-data-note">
          This chart uses the daily completion
          history already stored by Chorevera
          in this browser.
        </p>
      </section>

      <section className="executive-analytics-section">
        <div className="executive-analytics-heading">
          <div>
            <span className="eyebrow">Executive analytics</span>
            <h4>Household performance</h4>
            <p>Interactive insights from completion history, workload, and current household progress.</p>
          </div>

          <div className="analytics-range-toggle">
            <button className={analyticsRange === "7d" ? "selected" : ""} onClick={() => setAnalyticsRange("7d")} type="button">7 days</button>
            <button className={analyticsRange === "30d" ? "selected" : ""} onClick={() => setAnalyticsRange("30d")} type="button">30 days</button>
          </div>
        </div>

        <div className="executive-kpi-grid">
          <article><span>Average completion</span><strong>{analyticsAverage}%</strong><small>Across recorded days</small></article>
          <article><span>Perfect days</span><strong>{analyticsPerfectDays}</strong><small>100% completion days</small></article>
          <article><span>Chores completed</span><strong>{analyticsTotalCompleted}</strong><small>During selected range</small></article>
          <article><span>Recorded days</span><strong>{measurableAnalyticsDays.length}</strong><small>With measurable activity</small></article>
        </div>

        <div className="executive-analytics-grid">
          <article className="analytics-panel-card trend-panel">
            <div className="analytics-card-heading"><div><strong>Completion trend</strong><span>Daily percentage over time</span></div><BarChart3 size={20} /></div>
            {measurableAnalyticsDays.length === 0 ? (
              <div className="analytics-empty-state">Complete chores to begin building your trend line.</div>
            ) : (
              <div className="analytics-line-chart">
                <div className="analytics-y-axis"><span>100%</span><span>75%</span><span>50%</span><span>25%</span><span>0%</span></div>
                <div className="analytics-line-stage">
                  <div className="analytics-grid-lines"><span /><span /><span /><span /><span /></div>
                  <svg aria-label="Completion trend line chart" preserveAspectRatio="none" role="img" viewBox="0 0 720 220">
                    <path className="analytics-area-path" d={`${analyticsLinePath} L 720 220 L 0 220 Z`} />
                    <path className="analytics-line-path" d={analyticsLinePath} />
                  </svg>
                  <div className="analytics-x-axis">
                    {analyticsDays.filter((_, index) => index === 0 || index === analyticsDays.length - 1 || index % Math.max(1, Math.floor(analyticsDays.length / 4)) === 0).map((day) => (
                      <span key={day.dateKey}>{day.date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </article>

          <article className="analytics-panel-card donut-panel">
            <div className="analytics-card-heading"><div><strong>Current completion</strong><span>Completed versus remaining</span></div><Target size={20} /></div>
            <div className="completion-donut-layout">
              <div className="completion-donut" style={{ background: `conic-gradient(#5f6df5 0 ${completedShare}%, #e9edf5 ${completedShare}% 100%)` }}>
                <div><strong>{completedShare}%</strong><span>complete</span></div>
              </div>
              <div className="completion-donut-legend">
                <div><span className="legend-dot completed" /><div><strong>{householdCompletedCount}</strong><small>Completed</small></div></div>
                <div><span className="legend-dot remaining" /><div><strong>{householdRemainingCount}</strong><small>Remaining</small></div></div>
              </div>
            </div>
          </article>

          <article className="analytics-panel-card workload-panel">
            <div className="analytics-card-heading"><div><strong>Household workload</strong><span>Assigned chores by member</span></div><UserRound size={20} /></div>
            <div className="workload-chart-list">
              {memberProgress.map((item) => {
                const workloadPercentage = workloadTotal === 0 ? 0 : Math.round((item.assignedCount / workloadTotal) * 100);
                return (
                  <article key={item.member.user_id}>
                    <div className="workload-member-row"><strong>{item.member.name}</strong><span>{item.assignedCount} assigned</span></div>
                    <div className="workload-track"><div style={{ width: `${workloadPercentage}%` }} /></div>
                    <small>{workloadPercentage}% of household workload</small>
                  </article>
                );
              })}
            </div>
          </article>

          <article className="analytics-panel-card heatmap-panel">
            <div className="analytics-card-heading"><div><strong>Activity heatmap</strong><span>Last 30 days</span></div><CalendarDays size={20} /></div>
            <div className="analytics-heatmap">
              {buildAnalyticsDays(completionHistory, 30).map((day) => (
                <span className={day.percentage === 100 ? "level-4" : day.percentage >= 75 ? "level-3" : day.percentage >= 40 ? "level-2" : day.percentage > 0 ? "level-1" : "level-0"} key={day.dateKey} title={`${day.date.toLocaleDateString()}: ${day.hasData ? `${day.percentage}% complete` : "No recorded activity"}`} />
              ))}
            </div>
            <div className="heatmap-legend"><span>Less</span><i className="level-0" /><i className="level-1" /><i className="level-2" /><i className="level-3" /><i className="level-4" /><span>More</span></div>
          </article>
        </div>
      </section>

      <section className="household-calendar-section">
        <div className="calendar-heading">
          <div>
            <span className="eyebrow">
              Household calendar
            </span>

            <h4>
              {formatMonth(
                activeMonth,
              )}
            </h4>
          </div>

          <div className="calendar-navigation">
            <button
              aria-label="Previous month"
              onClick={() =>
                changeMonth(-1)
              }
              type="button"
            >
              <ChevronLeft size={18} />
            </button>

            <button
              onClick={() =>
                setActiveMonth(
                  new Date(),
                )
              }
              type="button"
            >
              Today
            </button>

            <button
              aria-label="Next month"
              onClick={() =>
                changeMonth(1)
              }
              type="button"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        <div className="household-calendar-weekdays">
          {[
            "Sun",
            "Mon",
            "Tue",
            "Wed",
            "Thu",
            "Fri",
            "Sat",
          ].map((day) => (
            <span key={day}>
              {day}
            </span>
          ))}
        </div>

        <div className="household-calendar-grid">
          {monthCells.map(
            (day, index) => {
              const isToday =
                day !== null &&
                activeMonth.getFullYear() ===
                  today.getFullYear() &&
                activeMonth.getMonth() ===
                  today.getMonth() &&
                day === today.getDate();

              return (
                <article
                  className={
                    isToday
                      ? "today"
                      : ""
                  }
                  key={`${day}-${index}`}
                >
                  {day !== null && (
                    <>
                      <strong>
                        {day}
                      </strong>

                      {isToday && (
                        <div className="calendar-chore-dots">
                          {choresByTime
                            .slice(
                              0,
                              4,
                            )
                            .map(
                              (chore) => (
                                <span
                                  className={
                                    chore.completed
                                      ? "complete"
                                      : ""
                                  }
                                  key={chore.id}
                                  title={
                                    chore.title
                                  }
                                />
                              ),
                            )}
                        </div>
                      )}
                    </>
                  )}
                </article>
              );
            },
          )}
        </div>

        <div className="today-calendar-agenda">
          <div>
            <CalendarDays size={19} />

            <strong>
              Today's household schedule
            </strong>
          </div>

          {choresByTime.length === 0 ? (
            <p>
              No household chores are
              scheduled.
            </p>
          ) : (
            <div className="calendar-agenda-list">
              {choresByTime.map(
                (chore) => (
                  <article
                    key={chore.id}
                  >
                    <span
                      className={
                        chore.completed
                          ? "complete"
                          : ""
                      }
                    >
                      {chore.completed ? (
                        <CheckCircle2
                          size={16}
                        />
                      ) : (
                        <Target
                          size={16}
                        />
                      )}
                    </span>

                    <div>
                      <strong>
                        {chore.title}
                      </strong>

                      <small>
                        {chore.reminderTime
                          ? `Reminder ${chore.reminderTime}`
                          : "No reminder"}
                      </small>
                    </div>
                  </article>
                ),
              )}
            </div>
          )}
        </div>
      </section>

      <section className="household-coach-section">
        <div className="household-coach-icon">
          <Sparkles size={24} />
        </div>

        <div className="household-coach-content">
          <span className="eyebrow">
            Smart household coach
          </span>

          <h4>
            Suggestions for{" "}
            {household.name}
          </h4>

          <div className="coach-message-list">
            {coachMessages.map(
              (message) => (
                <article
                  key={message}
                >
                  <Lightbulb
                    size={17}
                  />

                  <span>
                    {message}
                  </span>
                </article>
              ),
            )}
          </div>

          <p className="gamification-data-note">
            These suggestions are generated
            locally from current chore and
            member progress data.
          </p>
        </div>
      </section>
    </>
  );
}


