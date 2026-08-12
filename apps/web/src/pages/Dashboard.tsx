import {
  type FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  AlertTriangle,
  BarChart3,
  Bell,
  BellRing,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  CreditCard,
  Crown,
  ExternalLink,
  Flame,
  Home,
  LoaderCircle,
  LockKeyhole,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  Trophy,
  UserRound,
  Users,
  WandSparkles,
} from "lucide-react";

import {
  createChore as createChoreRequest,
  deleteChore as deleteChoreRequest,
  getChores,
  toggleChore as toggleChoreRequest,
  updateChore,
} from "../api/chores";

import {
  getProgressHistory as
    getProgressHistoryRequest,
  importProgressHistory as
    importProgressHistoryRequest,
  saveProgressSnapshot as
    saveProgressSnapshotRequest,
} from "../api/progress";

import {
  getMyHousehold,
} from "../api/households";

import HouseholdActivityFeed from
  "../components/household/HouseholdActivityFeed";

import HouseholdCommandCenter from
  "../components/household/HouseholdCommandCenter";

import NotificationCenter from
  "../components/notifications/NotificationCenter";

import HouseholdGamificationHub from
  "../components/household/HouseholdGamificationHub";

import {
  useAuth,
} from "../context/AuthContext";

import {
  HISTORY_STORAGE_KEY,
  LAST_ACTIVE_DATE_KEY,
} from "../constants/storage";

import {
  useBilling,
} from "../context/BillingContext";

import {
  useFeatures,
} from "../context/FeatureContext";

import type {
  Chore,
  ChoreScope,
  CompletionHistory,
  NotificationState,
} from "../types/chore";

import type {
  Household,
} from "../types/household";

import {
  calculateCurrentStreak,
  createDayHistory,
  formatTime,
  getCurrentTimeString,
  getLocalDateString,
} from "../utils/date";


type WorkspaceMode =
  | "personal"
  | "household";


function initializeHistory(): CompletionHistory {
  const savedHistory = localStorage.getItem(
    HISTORY_STORAGE_KEY,
  );

  if (!savedHistory) {
    return {};
  }

  try {
    return JSON.parse(
      savedHistory,
    ) as CompletionHistory;
  } catch {
    return {};
  }
}


function initializeNotificationState():
NotificationState {
  if (!("Notification" in window)) {
    return "unsupported";
  }

  return Notification.permission;
}


export default function Dashboard() {
  const {
    user,
  } = useAuth();

  const currentUserId =
    user?.id ?? null;

  const {
    billingStatus,
    isBillingLoading,
    isCheckoutLoading,
    isPortalLoading,
    billingError,
    billingMessage,
    refreshBillingStatus,
    beginCheckout,
    openBillingPortal,
  } = useBilling();

  const {
    features,
    isFeaturesLoading,
    featuresError,
    refreshFeatures,
    canUseAnalytics,
    canUseAdvancedReminders,
    canUseHouseholdSharing,
    canUseAiPlanning,
  } = useFeatures();

  const plan =
    features?.plan_name ??
    billingStatus?.plan_name ??
    "free";

  const hasPaidPlan =
    billingStatus?.is_paid ?? false;

  const [chores, setChores] =
    useState<Chore[]>([]);

  const [
    household,
    setHousehold,
  ] = useState<Household | null>(
    null,
  );

  const [
    scope,
    setScope,
  ] = useState<ChoreScope>(
    "all",
  );

  const [
    memberFilter,
    setMemberFilter,
  ] = useState<number | "all">(
    "all",
  );

  const [
    workspaceMode,
    setWorkspaceMode,
  ] = useState<WorkspaceMode>(
    "personal",
  );

  const [
    assignedUserId,
    setAssignedUserId,
  ] = useState<number | null>(
    currentUserId,
  );

  const [
    completionHistory,
    setCompletionHistory,
  ] = useState<CompletionHistory>(
    initializeHistory,
  );

  const [
    lastActiveDate,
    setLastActiveDate,
  ] = useState(
    () =>
      localStorage.getItem(
        LAST_ACTIVE_DATE_KEY,
      ) ?? getLocalDateString(),
  );

  const [title, setTitle] = useState("");

  const [reminderTime, setReminderTime] =
    useState("18:00");

  const [
    notificationState,
    setNotificationState,
  ] = useState<NotificationState>(
    initializeNotificationState,
  );

  const [
    notificationMessage,
    setNotificationMessage,
  ] = useState("");

  const [
    isLoadingChores,
    setIsLoadingChores,
  ] = useState(true);

  const [
    isAddingChore,
    setIsAddingChore,
  ] = useState(false);

  const [
    pendingChoreIds,
    setPendingChoreIds,
  ] = useState<Set<number>>(new Set());

  const [
    dashboardError,
    setDashboardError,
  ] = useState("");

  const [
    isLiveSyncing,
    setIsLiveSyncing,
  ] = useState(false);

  const [
    lastLiveSyncAt,
    setLastLiveSyncAt,
  ] = useState<Date | null>(
    null,
  );

  const [
    isProgressLoaded,
    setIsProgressLoaded,
  ] = useState(false);

  const notificationTimeoutRef =
    useRef<number | null>(null);

  const progressSyncTimeoutRef =
    useRef<number | null>(null);

  const lastProgressSignatureRef =
    useRef("");


  async function loadProgressHistory():
  Promise<void> {
    const cachedHistory =
      initializeHistory();

    try {
      let progress =
        await getProgressHistoryRequest(
          365,
        );

      if (
        Object.keys(
          progress.history,
        ).length === 0 &&
        Object.keys(
          cachedHistory,
        ).length > 0
      ) {
        progress =
          await importProgressHistoryRequest(
            cachedHistory,
          );
      }

      setCompletionHistory(
        progress.history,
      );
    } catch {
      // Preserve the browser cache if progress
      // synchronization is temporarily unavailable.
      setCompletionHistory(
        cachedHistory,
      );

      setNotificationMessage(
        "Progress history is using the local cache until synchronization is available.",
      );
    } finally {
      setIsProgressLoaded(
        true,
      );
    }
  }


  async function loadChores():
  Promise<void> {
    setIsLoadingChores(true);
    setDashboardError("");

    try {
      const [
        loadedChores,
        loadedHousehold,
      ] = await Promise.all([
        getChores({
          scope: "all",
        }),
        getMyHousehold(),
      ]);

      setHousehold(
        loadedHousehold,
      );

      if (
        currentUserId !== null
      ) {
        setAssignedUserId(
          currentUserId,
        );
      }

      const today =
        getLocalDateString();

      if (lastActiveDate !== today) {
        const previousDaySnapshot =
          createDayHistory(
            lastActiveDate,
            loadedChores,
          );

        setCompletionHistory(
          (currentHistory) => ({
            ...currentHistory,
            [lastActiveDate]:
              previousDaySnapshot,
          }),
        );

        void saveProgressSnapshotRequest(
          previousDaySnapshot,
        ).catch(
          () => {
            // The local cache remains available.
          },
        );

        const resetChores =
          await Promise.all(
            loadedChores.map(
              async (chore) => {
                if (!chore.completed) {
                  return chore;
                }

                return updateChore(
                  chore.id,
                  {
                    completed: false,
                  },
                );
              },
            ),
          );

        setChores(resetChores);
        setLastActiveDate(today);

        setNotificationMessage(
          "A new day has started. Your daily chores have been reset.",
        );
      } else {
        setChores(loadedChores);
      }
    } catch (error) {
      setDashboardError(
        error instanceof Error
          ? error.message
          : "Unable to load your chores.",
      );
    } finally {
      setIsLoadingChores(false);
    }
  }


  async function refreshLiveDashboard():
  Promise<void> {
    if (
      isLiveSyncing ||
      document.visibilityState !==
        "visible"
    ) {
      return;
    }

    setIsLiveSyncing(true);

    try {
      const [
        refreshedChores,
        refreshedHousehold,
      ] = await Promise.all([
        getChores({
          scope: "all",
        }),
        getMyHousehold(),
      ]);

      setChores(
        (currentChores) =>
          refreshedChores.map(
            (refreshedChore) => {
              const currentChore =
                currentChores.find(
                  (chore) =>
                    chore.id ===
                    refreshedChore.id,
                );

              return {
                ...refreshedChore,
                lastNotificationDate:
                  currentChore
                    ?.lastNotificationDate,
              };
            },
          ),
      );

      setHousehold(
        refreshedHousehold,
      );

      setLastLiveSyncAt(
        new Date(),
      );
    } catch {
      // Keep current content visible if a
      // background refresh temporarily fails.
    } finally {
      setIsLiveSyncing(false);
    }
  }


  useEffect(() => {
    void loadProgressHistory();
    void loadChores();
  }, []);


  useEffect(() => {
    const intervalId =
      window.setInterval(
        () => {
          void refreshLiveDashboard();
        },
        15_000,
      );

    function handleWindowFocus() {
      void refreshLiveDashboard();
    }

    function handleVisibilityChange() {
      if (
        document.visibilityState ===
        "visible"
      ) {
        void refreshLiveDashboard();
      }
    }

    window.addEventListener(
      "focus",
      handleWindowFocus,
    );

    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange,
    );

    return () => {
      window.clearInterval(
        intervalId,
      );

      window.removeEventListener(
        "focus",
        handleWindowFocus,
      );

      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange,
      );
    };
  }, [
    currentUserId,
    isLiveSyncing,
  ]);


  useEffect(() => {
    localStorage.setItem(
      HISTORY_STORAGE_KEY,
      JSON.stringify(
        completionHistory,
      ),
    );
  }, [completionHistory]);


  useEffect(() => {
    localStorage.setItem(
      LAST_ACTIVE_DATE_KEY,
      lastActiveDate,
    );
  }, [lastActiveDate]);


  useEffect(() => {
    if (isLoadingChores) {
      return;
    }

    const today =
      getLocalDateString();

    const todaySnapshot =
      createDayHistory(
        today,
        chores,
      );

    setCompletionHistory(
      (currentHistory) => ({
        ...currentHistory,
        [today]:
          todaySnapshot,
      }),
    );

    if (!isProgressLoaded) {
      return;
    }

    const signature =
      JSON.stringify({
        date:
          todaySnapshot.date,
        total:
          todaySnapshot.totalCount,
        completed:
          todaySnapshot.completedCount,
      });

    if (
      lastProgressSignatureRef.current
      === signature
    ) {
      return;
    }

    if (
      progressSyncTimeoutRef.current
      !== null
    ) {
      window.clearTimeout(
        progressSyncTimeoutRef.current,
      );
    }

    progressSyncTimeoutRef.current =
      window.setTimeout(
        () => {
          void saveProgressSnapshotRequest(
            todaySnapshot,
          )
            .then(() => {
              lastProgressSignatureRef.current =
                signature;
            })
            .catch(() => {
              // Keep the local cache and retry on
              // the next meaningful chore change.
            })
            .finally(() => {
              progressSyncTimeoutRef.current =
                null;
            });
        },
        500,
      );
  }, [
    chores,
    isLoadingChores,
    isProgressLoaded,
  ]);


  useEffect(() => {
    async function checkForNewDay() {
      const today =
        getLocalDateString();

      if (
        today === lastActiveDate ||
        isLoadingChores
      ) {
        return;
      }

      const previousDaySnapshot =
        createDayHistory(
          lastActiveDate,
          chores,
        );

      setCompletionHistory(
        (currentHistory) => ({
          ...currentHistory,
          [lastActiveDate]:
            previousDaySnapshot,
        }),
      );

      void saveProgressSnapshotRequest(
        previousDaySnapshot,
      ).catch(
        () => {
          // The local cache remains available.
        },
      );

      try {
        const resetChores =
          await Promise.all(
            chores.map(
              async (chore) => {
                if (!chore.completed) {
                  return chore;
                }

                return updateChore(
                  chore.id,
                  {
                    completed: false,
                  },
                );
              },
            ),
          );

        setChores(resetChores);
        setLastActiveDate(today);

        setNotificationMessage(
          "A new day has started. Your daily chores have been reset.",
        );
      } catch (error) {
        setDashboardError(
          error instanceof Error
            ? error.message
            : "Unable to reset daily chores.",
        );
      }
    }

    const intervalId =
      window.setInterval(
        () => {
          void checkForNewDay();
        },
        30_000,
      );

    function handleVisibilityChange() {
      if (
        document.visibilityState ===
        "visible"
      ) {
        void checkForNewDay();
      }
    }

    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange,
    );

    return () => {
      window.clearInterval(
        intervalId,
      );

      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange,
      );
    };
  }, [
    chores,
    isLoadingChores,
    lastActiveDate,
  ]);


  useEffect(() => {
    function checkChoreReminders() {
      if (
        !("Notification" in window) ||
        Notification.permission !==
          "granted"
      ) {
        return;
      }

      const currentTime =
        getCurrentTimeString();

      const currentDate =
        getLocalDateString();

      const choresToNotify =
        chores.filter(
          (chore) =>
            !chore.completed &&
            chore.assignedUserId ===
              currentUserId &&
            chore.reminderTime ===
              currentTime &&
            chore.lastNotificationDate !==
              currentDate,
        );

      if (
        choresToNotify.length === 0
      ) {
        return;
      }

      choresToNotify.forEach(
        (chore) => {
          const notification =
            new Notification(
              "ChoreFlow Reminder",
              {
                body:
                  `Itâ€™s time to ` +
                  `${chore.title.toLowerCase()}.`,
                icon: "/vite.svg",
                tag:
                  `chore-${chore.id}-` +
                  `${currentDate}`,
              },
            );

          notification.onclick = () => {
            window.focus();
            notification.close();
          };
        },
      );

      const notifiedIds =
        new Set(
          choresToNotify.map(
            (chore) => chore.id,
          ),
        );

      setChores(
        (currentChores) =>
          currentChores.map(
            (chore) =>
              notifiedIds.has(
                chore.id,
              )
                ? {
                    ...chore,
                    lastNotificationDate:
                      currentDate,
                  }
                : chore,
          ),
      );
    }

    checkChoreReminders();

    const intervalId =
      window.setInterval(
        checkChoreReminders,
        15_000,
      );

    return () => {
      window.clearInterval(
        intervalId,
      );
    };
  }, [chores, currentUserId]);


  useEffect(() => {
    return () => {
      if (
        notificationTimeoutRef.current !==
        null
      ) {
        window.clearTimeout(
          notificationTimeoutRef.current,
        );
      }

      if (
        progressSyncTimeoutRef.current !==
        null
      ) {
        window.clearTimeout(
          progressSyncTimeoutRef.current,
        );
      }
    };
  }, []);


  const isHouseholdOwner =
    household?.current_user_role ===
    "owner";

  const memberById =
    useMemo(
      () =>
        new Map(
          (
            household?.members ??
            []
          ).map(
            (member) => [
              member.user_id,
              member,
            ],
          ),
        ),
      [household],
    );

  const visibleChores =
    useMemo(() => {
      let result = chores;

      if (scope === "mine") {
        result = result.filter(
          (chore) =>
            chore.assignedUserId ===
            currentUserId,
        );
      }

      if (scope === "personal") {
        result = result.filter(
          (chore) =>
            chore.householdId === null,
        );
      }

      if (scope === "household") {
        result = result.filter(
          (chore) =>
            chore.householdId !== null,
        );
      }

      if (memberFilter !== "all") {
        result = result.filter(
          (chore) =>
            chore.assignedUserId ===
            memberFilter,
        );
      }

      return result;
    }, [
      chores,
      currentUserId,
      memberFilter,
      scope,
    ]);

  const completedCount =
    useMemo(
      () =>
        visibleChores.filter(
          (chore) =>
            chore.completed,
        ).length,
      [visibleChores],
    );

  const remainingCount =
    visibleChores.length -
    completedCount;

  const completionPercentage =
    visibleChores.length === 0
      ? 0
      : Math.round(
          (
            completedCount /
            visibleChores.length
          ) * 100,
        );

  const currentStreak =
    useMemo(
      () =>
        calculateCurrentStreak(
          completionHistory,
          visibleChores,
        ),
      [
        completionHistory,
        visibleChores,
      ],
    );

  const historyDays =
    useMemo(
      () =>
        Object.values(
          completionHistory,
        ),
      [completionHistory],
    );

  const completedDays =
    useMemo(
      () =>
        historyDays.filter(
          (day) =>
            day.allCompleted,
        ).length,
      [historyDays],
    );

  const averageCompletion =
    useMemo(() => {
      const measurableDays =
        historyDays.filter(
          (day) =>
            day.totalCount > 0,
        );

      if (
        measurableDays.length === 0
      ) {
        return 0;
      }

      const totalPercentage =
        measurableDays.reduce(
          (sum, day) =>
            sum +
            (
              day.completedCount /
              day.totalCount
            ) * 100,
          0,
        );

      return Math.round(
        totalPercentage /
        measurableDays.length,
      );
    }, [historyDays]);

  const perfectDayRate =
    historyDays.length === 0
      ? 0
      : Math.round(
          (
            completedDays /
            historyDays.length
          ) * 100,
        );

  const maxChores =
    features?.max_chores ?? null;

  const hasReachedChoreLimit =
    maxChores !== null &&
    chores.length >= maxChores;

  const availableChoreSlots =
    maxChores === null
      ? null
      : Math.max(
          maxChores - chores.length,
          0,
        );

  const householdChores =
    useMemo(
      () =>
        household
          ? chores.filter(
              (chore) =>
                chore.householdId ===
                household.id,
            )
          : [],
      [chores, household],
    );

  const householdCompletedCount =
    useMemo(
      () =>
        householdChores.filter(
          (chore) =>
            chore.completed,
        ).length,
      [householdChores],
    );

  const householdRemainingCount =
    householdChores.length -
    householdCompletedCount;

  const householdCompletionPercentage =
    householdChores.length === 0
      ? 0
      : Math.round(
          (
            householdCompletedCount /
            householdChores.length
          ) * 100,
        );

  const memberProgress =
    useMemo(() => {
      if (!household) {
        return [];
      }

      return household.members
        .map((member) => {
          const assignedChores =
            householdChores.filter(
              (chore) =>
                chore.assignedUserId ===
                member.user_id,
            );

          const completed =
            assignedChores.filter(
              (chore) =>
                chore.completed,
            ).length;

          const percentage =
            assignedChores.length === 0
              ? 0
              : Math.round(
                  (
                    completed /
                    assignedChores.length
                  ) * 100,
                );

          return {
            member,
            assignedCount:
              assignedChores.length,
            completedCount:
              completed,
            remainingCount:
              assignedChores.length -
              completed,
            percentage,
          };
        })
        .sort(
          (first, second) =>
            second.percentage -
            first.percentage,
        );
    }, [
      household,
      householdChores,
    ]);

  const topHouseholdMember =
    memberProgress.find(
      (item) =>
        item.assignedCount > 0,
    ) ?? null;

  const membersNeedingAttention =
    memberProgress.filter(
      (item) =>
        item.remainingCount > 0,
    );

  const unassignedHouseholdChores =
    useMemo(
      () =>
        householdChores.filter(
          (chore) =>
            !chore.completed &&
            chore.assignedUserId ===
              null,
        ),
      [householdChores],
    );

  const mostOverloadedMember =
    useMemo(
      () =>
        [...memberProgress]
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
          )[0] ?? null,
      [memberProgress],
    );

  const commandCenterAlertCount =
    membersNeedingAttention.length +
    (
      unassignedHouseholdChores.length >
      0
        ? 1
        : 0
    );

  function markChorePending(
    choreId: number,
  ): void {
    setPendingChoreIds(
      (currentPendingIds) => {
        const nextPendingIds =
          new Set(
            currentPendingIds,
          );

        nextPendingIds.add(
          choreId,
        );

        return nextPendingIds;
      },
    );
  }


  function clearChorePending(
    choreId: number,
  ): void {
    setPendingChoreIds(
      (currentPendingIds) => {
        const nextPendingIds =
          new Set(
            currentPendingIds,
          );

        nextPendingIds.delete(
          choreId,
        );

        return nextPendingIds;
      },
    );
  }


  function scrollToDashboardSection(
    sectionId: string,
  ): void {
    document
      .getElementById(
        sectionId,
      )
      ?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
  }


  function focusHouseholdAssignments():
  void {
    setScope(
      "household",
    );

    setMemberFilter(
      "all",
    );

    window.setTimeout(
      () => {
        scrollToDashboardSection(
          "shared-chore-view",
        );
      },
      0,
    );
  }


  function openAutoAssignment():
  void {
    scrollToDashboardSection(
      "smart-assignment-panel",
    );
  }


  async function sendHouseholdReminder():
  Promise<void> {
    if (
      householdRemainingCount === 0
    ) {
      setNotificationMessage(
        "The household is already caught up.",
      );

      return;
    }

    if (
      !("Notification" in window)
    ) {
      setNotificationMessage(
        "This browser does not support notifications.",
      );

      return;
    }

    let permission =
      Notification.permission;

    if (
      permission === "default"
    ) {
      permission =
        await Notification.requestPermission();

      setNotificationState(
        permission,
      );
    }

    if (
      permission !== "granted"
    ) {
      setNotificationMessage(
        "Enable browser notifications before sending a household reminder.",
      );

      return;
    }

    const memberSummary =
      membersNeedingAttention
        .map(
          (item) =>
            `${item.member.name}: ` +
            `${item.remainingCount}`,
        )
        .join(", ");

    const notification =
      new Notification(
        `${household?.name ?? "Household"} reminder`,
        {
          body:
            `${householdRemainingCount} ` +
            `${
              householdRemainingCount === 1
                ? "chore remains"
                : "chores remain"
            }` +
            `${
              memberSummary
                ? `. ${memberSummary}.`
                : "."
            }`,
          icon: "/vite.svg",
          tag:
            `household-reminder-` +
            `${household?.id ?? "current"}`,
        },
      );

    notification.onclick = () => {
      window.focus();

      focusHouseholdAssignments();

      notification.close();
    };

    setNotificationMessage(
      "Household reminder sent on this device.",
    );
  }


  async function requestNotificationPermission() {
    if (!("Notification" in window)) {
      setNotificationState(
        "unsupported",
      );

      setNotificationMessage(
        "This browser does not support desktop notifications.",
      );

      return;
    }

    try {
      const permission =
        await Notification.requestPermission();

      setNotificationState(
        permission,
      );

      if (
        permission === "granted"
      ) {
        setNotificationMessage(
          "Notifications are enabled. ChoreFlow can now remind you while the app is open.",
        );

        new Notification(
          "ChoreFlow notifications enabled",
          {
            body:
              "Your chore reminders are ready.",
            icon: "/vite.svg",
          },
        );
      } else if (
        permission === "denied"
      ) {
        setNotificationMessage(
          "Notifications were blocked. Enable them from your browserâ€™s site settings.",
        );
      } else {
        setNotificationMessage(
          "Notification permission was not granted.",
        );
      }
    } catch {
      setNotificationMessage(
        "ChoreFlow could not enable notifications.",
      );
    }
  }


  function sendImmediateTestNotification() {
    if (
      !("Notification" in window) ||
      Notification.permission !==
        "granted"
    ) {
      setNotificationMessage(
        "Enable notifications before sending a test.",
      );

      return;
    }

    const notification =
      new Notification(
        "ChoreFlow Test",
        {
          body:
            "Notifications are working correctly.",
          icon: "/vite.svg",
          tag:
            "choreflow-immediate-test",
        },
      );

    notification.onclick = () => {
      window.focus();
      notification.close();
    };

    setNotificationMessage(
      "Test notification sent.",
    );
  }


  function scheduleTestReminder() {
    if (!canUseAdvancedReminders) {
      setNotificationMessage(
        "Advanced test reminders require a Pro or Family subscription.",
      );

      return;
    }

    if (
      !("Notification" in window) ||
      Notification.permission !==
        "granted"
    ) {
      setNotificationMessage(
        "Enable notifications before scheduling a test reminder.",
      );

      return;
    }

    if (
      notificationTimeoutRef.current !==
      null
    ) {
      window.clearTimeout(
        notificationTimeoutRef.current,
      );
    }

    setNotificationMessage(
      "Test reminder scheduled. Keep ChoreFlow open for 5 minutes.",
    );

    notificationTimeoutRef.current =
      window.setTimeout(
        () => {
          const notification =
            new Notification(
              "ChoreFlow Test Reminder",
              {
                body:
                  "This is your test chore reminder.",
                icon: "/vite.svg",
                tag:
                  "choreflow-test-reminder",
              },
            );

          notification.onclick = () => {
            window.focus();
            notification.close();
          };

          setNotificationMessage(
            "Your test reminder was sent.",
          );

          notificationTimeoutRef.current =
            null;
        },
        5 * 60 * 1000,
      );
  }


  function canToggleChore(
    chore: Chore,
  ): boolean {
    if (chore.householdId === null) {
      return chore.ownerId === currentUserId;
    }

    return (
      isHouseholdOwner ||
      chore.assignedUserId === currentUserId
    );
  }


  function canDeleteChore(
    chore: Chore,
  ): boolean {
    if (chore.householdId === null) {
      return chore.ownerId === currentUserId;
    }

    return isHouseholdOwner;
  }


  async function addChore(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const trimmedTitle =
      title.trim();

    if (
      !trimmedTitle ||
      hasReachedChoreLimit ||
      isAddingChore
    ) {
      return;
    }

    setIsAddingChore(true);
    setDashboardError("");

    try {
      const newChore =
        await createChoreRequest({
          title: trimmedTitle,
          reminderTime,
          householdId:
            workspaceMode === "household"
              ? household?.id ?? null
              : null,
          assignedUserId:
            workspaceMode === "household"
              ? assignedUserId
              : currentUserId,
        });

      setChores(
        (currentChores) => [
          newChore,
          ...currentChores,
        ],
      );

      setTitle("");
    } catch (error) {
      setDashboardError(
        error instanceof Error
          ? error.message
          : "Unable to create the chore.",
      );
    } finally {
      setIsAddingChore(false);
    }
  }


  async function toggleChore(
    choreId: number,
  ) {
    if (
      pendingChoreIds.has(
        choreId,
      )
    ) {
      return;
    }

    markChorePending(choreId);
    setDashboardError("");

    try {
      const updatedChore =
        await toggleChoreRequest(
          choreId,
        );

      setChores(
        (currentChores) =>
          currentChores.map(
            (chore) =>
              chore.id === choreId
                ? {
                    ...updatedChore,
                    lastNotificationDate:
                      chore.lastNotificationDate,
                  }
                : chore,
          ),
      );
    } catch (error) {
      setDashboardError(
        error instanceof Error
          ? error.message
          : "Unable to update the chore.",
      );
    } finally {
      clearChorePending(
        choreId,
      );
    }
  }


  async function deleteChore(
    choreId: number,
  ) {
    if (
      pendingChoreIds.has(
        choreId,
      )
    ) {
      return;
    }

    markChorePending(choreId);
    setDashboardError("");

    try {
      await deleteChoreRequest(
        choreId,
      );

      setChores(
        (currentChores) =>
          currentChores.filter(
            (chore) =>
              chore.id !== choreId,
          ),
      );
    } catch (error) {
      setDashboardError(
        error instanceof Error
          ? error.message
          : "Unable to delete the chore.",
      );

      clearChorePending(
        choreId,
      );
    }
  }


  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-icon">
            <CheckCircle2 size={24} />
          </div>

          <div>
            <h1>ChoreFlow</h1>
            <p>
              Build better daily routines.
            </p>
          </div>
        </div>

        <div className="topbar-actions">
          <button
            aria-label="Refresh dashboard now"
            className={
              `live-sync-status ` +
              `${
                isLiveSyncing
                  ? "syncing"
                  : "connected"
              }`
            }
            onClick={() => {
              void refreshLiveDashboard();
            }}
            title={
              lastLiveSyncAt
                ? (
                    `Last synced at ` +
                    `${lastLiveSyncAt.toLocaleTimeString()}`
                  )
                : "Live sync is active"
            }
            type="button"
          >
            <RefreshCw
              className={
                isLiveSyncing
                  ? "spinning-icon"
                  : ""
              }
              size={16}
            />

            <span>
              {isLiveSyncing
                ? "Syncing"
                : "Live"}
            </span>
          </button>

          <NotificationCenter />

          <div
            className={
              `plan-badge ${plan}`
            }
          >
            <Crown size={16} />
            <span>
              {plan} plan
            </span>
          </div>
        </div>
      </header>

      <main className="dashboard">
        {dashboardError && (
          <div
            className=
              "dashboard-message error"
            role="alert"
          >
            <span>
              {dashboardError}
            </span>

            <button
              onClick={() => {
                void loadChores();
              }}
              type="button"
            >
              <RefreshCw size={16} />
              Try again
            </button>
          </div>
        )}

        <section className="hero-card">
          <div>
            <span className="eyebrow">
              Todayâ€™s progress
            </span>

            <h2>
              {isLoadingChores
                ? "Loading your routine..."
                : remainingCount === 0 &&
                    visibleChores.length > 0
                  ? "Everything is complete!"
                  : visibleChores.length === 0
                    ? "Create your first daily chore."
                    : (
                        `You have ` +
                        `${remainingCount} ` +
                        `chore${
                          remainingCount ===
                          1
                            ? ""
                            : "s"
                        } remaining.`
                      )}
            </h2>

            <p>
              Your chores are saved
              securely to your
              ChoreFlow account.
            </p>
          </div>

          <div className="progress-circle">
            <strong>
              {completionPercentage}%
            </strong>

            <span>complete</span>
          </div>
        </section>

        <section className="stats-grid">
          <article className="stat-card">
            <div className="stat-icon">
              <CalendarDays
                size={21}
              />
            </div>

            <div>
              <span>
                Todayâ€™s chores
              </span>

              <strong>
                {visibleChores.length}
              </strong>
            </div>
          </article>

          <article className="stat-card">
            <div className="stat-icon">
              <Check size={21} />
            </div>

            <div>
              <span>
                Completed today
              </span>

              <strong>
                {completedCount}
              </strong>
            </div>
          </article>

          <article className="stat-card">
            <div className="stat-icon">
              <Flame size={21} />
            </div>

            <div>
              <span>
                Current streak
              </span>

              <strong>
                {currentStreak}{" "}
                {currentStreak === 1
                  ? "day"
                  : "days"}
              </strong>
            </div>
          </article>
        </section>

        {household && (
          <section className="panel family-command-center">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">
                  Family command center
                </span>

                <h3>
                  {household.name}
                </h3>
              </div>

              <div className="feature-access-badge active">
                <Home size={15} />
                {household.member_count}{" "}
                {household.member_count === 1
                  ? "member"
                  : "members"}
              </div>
            </div>

            <div className="command-center-summary">
              <article>
                <span>
                  Household progress
                </span>

                <strong>
                  {householdCompletionPercentage}%
                </strong>

                <div className="command-progress-track">
                  <div
                    style={{
                      width:
                        `${householdCompletionPercentage}%`,
                    }}
                  />
                </div>
              </article>

              <article>
                <span>
                  Household chores
                </span>

                <strong>
                  {householdChores.length}
                </strong>

                <p>
                  {householdCompletedCount} completed
                </p>
              </article>

              <article>
                <span>
                  Remaining
                </span>

                <strong>
                  {householdRemainingCount}
                </strong>

                <p>
                  Across all members
                </p>
              </article>

              <article>
                <span>
                  Top progress
                </span>

                <strong>
                  {topHouseholdMember
                    ? topHouseholdMember.member.name
                    : "No activity"}
                </strong>

                <p>
                  {topHouseholdMember
                    ? `${topHouseholdMember.percentage}% complete`
                    : "Assign a household chore"}
                </p>
              </article>
            </div>

            <HouseholdCommandCenter
              activeAlertCount={
                commandCenterAlertCount
              }
              householdCompletionPercentage={
                householdCompletionPercentage
              }
              householdRemainingCount={
                householdRemainingCount
              }
              isHouseholdOwner={
                isHouseholdOwner
              }
              mostOverloadedMember={
                mostOverloadedMember
                  ? {
                      name:
                        mostOverloadedMember
                          .member.name,
                      remainingCount:
                        mostOverloadedMember
                          .remainingCount,
                    }
                  : null
              }
              onAutoBalance={
                openAutoAssignment
              }
              onReviewAssignments={
                focusHouseholdAssignments
              }
              onSendReminder={() => {
                void sendHouseholdReminder();
              }}
              unassignedChoreCount={
                unassignedHouseholdChores.length
              }
            />

            <div className="command-center-grid">
              <div>
                <div className="command-section-heading">
                  <div>
                    <span className="eyebrow">
                      Members
                    </span>

                    <h4>
                      Family progress
                    </h4>
                  </div>

                  <Trophy size={20} />
                </div>

                <div className="family-member-progress-list">
                  {memberProgress.map(
                    ({
                      member,
                      assignedCount,
                      completedCount:
                        memberCompletedCount,
                      percentage,
                    }) => (
                      <article
                        key={member.user_id}
                      >
                        <div className="family-member-avatar">
                          <UserRound size={18} />
                        </div>

                        <div className="family-member-progress-copy">
                          <div>
                            <strong>
                              {member.name}
                            </strong>

                            <span>
                              {memberCompletedCount}/
                              {assignedCount} complete
                            </span>
                          </div>

                          <div className="command-progress-track">
                            <div
                              style={{
                                width:
                                  `${percentage}%`,
                              }}
                            />
                          </div>
                        </div>

                        <strong className="family-member-percentage">
                          {percentage}%
                        </strong>
                      </article>
                    ),
                  )}
                </div>
              </div>

              <div>
                <div className="command-section-heading">
                  <div>
                    <span className="eyebrow">
                      Needs attention
                    </span>

                    <h4>
                      Incomplete assignments
                    </h4>
                  </div>

                  <AlertTriangle size={20} />
                </div>

                {membersNeedingAttention.length === 0 ? (
                  <div className="command-empty-state">
                    <CheckCircle2 size={27} />

                    <strong>
                      Household is caught up
                    </strong>

                    <span>
                      Every assigned household chore
                      is complete.
                    </span>
                  </div>
                ) : (
                  <div className="attention-member-list">
                    {membersNeedingAttention.map(
                      ({
                        member,
                        remainingCount:
                          memberRemainingCount,
                        percentage,
                      }) => (
                        <article
                          key={member.user_id}
                        >
                          <div>
                            <strong>
                              {member.name}
                            </strong>

                            <span>
                              {memberRemainingCount}{" "}
                              {memberRemainingCount === 1
                                ? "chore"
                                : "chores"}{" "}
                              remaining
                            </span>
                          </div>

                          <strong>
                            {percentage}%
                          </strong>
                        </article>
                      ),
                    )}
                  </div>
                )}
              </div>
            </div>

            <HouseholdGamificationHub
              household={household}
              householdChores={householdChores}
              memberProgress={memberProgress}
              householdCompletionPercentage={
                householdCompletionPercentage
              }
              householdCompletedCount={
                householdCompletedCount
              }
              householdRemainingCount={
                householdRemainingCount
              }
              completionHistory={
                completionHistory
              }
              isHouseholdOwner={
                isHouseholdOwner
              }
              onChoresUpdated={
                setChores
              }
            />

            <HouseholdActivityFeed />
          </section>
        )}

        <section
          className="panel shared-chore-controls"
          id="shared-chore-view"
        >
          <div className="panel-heading">
            <div>
              <span className="eyebrow">
                Shared chore view
              </span>

              <h3>
                Filter assignments
              </h3>
            </div>

            {household && (
              <div className="feature-access-badge active">
                <Home size={15} />
                {household.name}
              </div>
            )}
          </div>

          <div className="chore-filter-row">
            {(
              [
                ["all", "Everyone"],
                ["mine", "Mine"],
                ["personal", "Personal"],
                ["household", "Household"],
              ] as const
            ).map(([value, label]) => (
              <button
                className={
                  scope === value
                    ? "selected"
                    : ""
                }
                key={value}
                onClick={() =>
                  setScope(value)
                }
                type="button"
              >
                {label}
              </button>
            ))}
          </div>

          {household && (
            <label className="member-filter-control">
              Member

              <select
                onChange={(event) => {
                  const value =
                    event.target.value;

                  setMemberFilter(
                    value === "all"
                      ? "all"
                      : Number(value),
                  );
                }}
                value={memberFilter}
              >
                <option value="all">
                  All members
                </option>

                {household.members.map(
                  (member) => (
                    <option
                      key={member.user_id}
                      value={member.user_id}
                    >
                      {member.name}
                    </option>
                  ),
                )}
              </select>
            </label>
          )}
        </section>

        <section className="content-grid">
          <div className="main-column">
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">
                    Daily routine
                  </span>

                  <h3>
                    Todayâ€™s chores
                  </h3>
                </div>

                <span className="chore-count">
                  {completedCount}/
                  {visibleChores.length} complete
                </span>
              </div>

              <div className="progress-bar">
                <div
                  className=
                    "progress-bar-fill"
                  style={{
                    width:
                      `${completionPercentage}%`,
                  }}
                />
              </div>

              <div className="chore-list">
                {isLoadingChores ? (
                  <div className="empty-state">
                    <LoaderCircle
                      className=
                        "spinning-icon"
                      size={40}
                    />

                    <h4>
                      Loading your chores
                    </h4>

                    <p>
                      ChoreFlow is
                      synchronizing with
                      your account.
                    </p>
                  </div>
                ) : visibleChores.length ===
                  0 ? (
                  <div className="empty-state">
                    <CheckCircle2
                      size={40}
                    />

                    <h4>No chores yet</h4>

                    <p>
                      Add your first
                      cloud-synced chore
                      using the form below.
                    </p>
                  </div>
                ) : (
                  visibleChores.map(
                    (chore) => {
                      const isPending =
                        pendingChoreIds.has(
                          chore.id,
                        );

                      return (
                        <article
                          className={
                            `chore-card ` +
                            `${
                              chore.completed
                                ? "completed"
                                : ""
                            }`
                          }
                          key={chore.id}
                        >
                          <button
                            aria-label={
                              chore.completed
                                ? (
                                    `Mark ` +
                                    `${chore.title} ` +
                                    `incomplete`
                                  )
                                : (
                                    `Mark ` +
                                    `${chore.title} ` +
                                    `complete`
                                  )
                            }
                            className=
                              "complete-button"
                            disabled={
                              isPending ||
                              !canToggleChore(
                                chore,
                              )
                            }
                            onClick={() => {
                              void toggleChore(
                                chore.id,
                              );
                            }}
                            type="button"
                          >
                            {isPending ? (
                              <LoaderCircle
                                className=
                                  "spinning-icon"
                                size={17}
                              />
                            ) : chore.completed ? (
                              <Check
                                size={18}
                              />
                            ) : null}
                          </button>

                          <div className=
                            "chore-details"
                          >
                            <h4>
                              {chore.title}
                            </h4>

                            <p>
                              <Bell
                                size={14}
                              />

                              {formatTime(
                                chore.reminderTime,
                              )}
                            </p>

                            <div className="chore-assignment-meta">
                              <span
                                className={
                                  chore.householdId
                                    ? "household-chore-badge"
                                    : "personal-chore-badge"
                                }
                              >
                                {chore.householdId
                                  ? "Household"
                                  : "Personal"}
                              </span>

                              <span className="assignee-badge">
                                <UserRound size={13} />
                                {chore.assignedUserId
                                  ? (
                                      memberById.get(
                                        chore.assignedUserId,
                                      )?.name ??
                                      (
                                        chore.assignedUserId ===
                                        currentUserId
                                          ? "You"
                                          : "Assigned member"
                                      )
                                    )
                                  : "Unassigned"}
                              </span>
                            </div>
                          </div>

                          {canDeleteChore(chore) && (
                          <button
                            aria-label={
                              `Delete ` +
                              `${chore.title}`
                            }
                            className=
                              "delete-button"
                            disabled={
                              isPending
                            }
                            onClick={() => {
                              void deleteChore(
                                chore.id,
                              );
                            }}
                            type="button"
                          >
                            <Trash2
                              size={18}
                            />
                          </button>
                          )}
                        </article>
                      );
                    },
                  )
                )}
              </div>
            </section>

            <section className="panel">
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">
                    Create reminder
                  </span>

                  <h3>
                    Add a new chore
                  </h3>
                </div>
              </div>

              <form
                className="chore-form"
                onSubmit={addChore}
              >
                <label>
                  Chore name

                  <input
                    disabled={
                      isAddingChore
                    }
                    maxLength={100}
                    onChange={(
                      event,
                    ) =>
                      setTitle(
                        event.target.value,
                      )
                    }
                    placeholder=
                      "Example: Feed the dog"
                    type="text"
                    value={title}
                  />
                </label>

                <label>
                  Reminder time

                  <input
                    disabled={
                      isAddingChore
                    }
                    onChange={(
                      event,
                    ) =>
                      setReminderTime(
                        event.target.value,
                      )
                    }
                    type="time"
                    value={reminderTime}
                  />
                </label>

                <label>
                  Workspace

                  <select
                    disabled={
                      isAddingChore ||
                      isFeaturesLoading
                    }
                    onChange={(event) => {
                      const mode =
                        event.target.value as
                        WorkspaceMode;

                      setWorkspaceMode(mode);

                      if (mode === "personal") {
                        setAssignedUserId(
                          currentUserId,
                        );
                      }
                    }}
                    value={workspaceMode}
                  >
                    <option value="personal">
                      Personal
                    </option>

                    <option
                      disabled={
                        !household ||
                        !canUseHouseholdSharing
                      }
                      value="household"
                    >
                      Household
                    </option>
                  </select>
                </label>

                {workspaceMode === "household" && (
                  <label>
                    Assigned to

                    <select
                      disabled={
                        isAddingChore ||
                        !household
                      }
                      onChange={(event) =>
                        setAssignedUserId(
                          Number(
                            event.target.value,
                          ),
                        )
                      }
                      value={
                        assignedUserId ?? ""
                      }
                    >
                      {household?.members.map(
                        (member) => (
                          <option
                            disabled={
                              !isHouseholdOwner &&
                              member.user_id !==
                                currentUserId
                            }
                            key={member.user_id}
                            value={member.user_id}
                          >
                            {member.name}
                            {member.user_id ===
                            currentUserId
                              ? " (You)"
                              : ""}
                          </option>
                        ),
                      )}
                    </select>
                  </label>
                )}

                <button
                  className=
                    "primary-button"
                  disabled={
                    hasReachedChoreLimit ||
                    isAddingChore
                  }
                  type="submit"
                >
                  {isAddingChore ? (
                    <LoaderCircle
                      className=
                        "spinning-icon"
                      size={19}
                    />
                  ) : (
                    <Plus size={19} />
                  )}

                  {isAddingChore
                    ? "Saving..."
                    : "Add chore"}
                </button>
              </form>

              {isFeaturesLoading && (
                <div className="limit-warning">
                  Loading your plan limits...
                </div>
              )}

              {featuresError && (
                <div className="limit-warning">
                  {featuresError}{" "}
                  <button
                    onClick={() => {
                      void refreshFeatures();
                    }}
                    type="button"
                  >
                    Retry
                  </button>
                </div>
              )}

              {hasReachedChoreLimit && (
                <div className="limit-warning">
                  You reached your plan limit of{" "}
                  {maxChores} chores. Upgrade to Pro
                  or Family for unlimited chores.
                </div>
              )}

              {!hasReachedChoreLimit &&
                availableChoreSlots !== null && (
                  <div className="plan-usage-note">
                    {availableChoreSlots} chore{" "}
                    {availableChoreSlots === 1
                      ? "slot"
                      : "slots"}{" "}
                    remaining on your current plan.
                  </div>
                )}
            </section>

            <section className=
              "panel notification-panel"
            >
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">
                    Reminder settings
                  </span>

                  <h3>
                    Browser notifications
                  </h3>
                </div>

                <div
                  className={
                    `notification-status ` +
                    `${notificationState}`
                  }
                >
                  {notificationState ===
                  "granted"
                    ? "Enabled"
                    : notificationState ===
                        "denied"
                      ? "Blocked"
                      : notificationState ===
                          "unsupported"
                        ? "Unsupported"
                        : "Not enabled"}
                </div>
              </div>

              <p className=
                "notification-description"
              >
                ChoreFlow checks your
                incomplete chores and
                sends a reminder when
                their scheduled time
                arrives.
              </p>

              <div className=
                "notification-actions"
              >
                <button
                  className=
                    "primary-button"
                  onClick={
                    requestNotificationPermission
                  }
                  type="button"
                >
                  <BellRing size={18} />
                  Enable notifications
                </button>

                <button
                  className=
                    "secondary-button"
                  onClick={
                    sendImmediateTestNotification
                  }
                  type="button"
                >
                  <Bell size={18} />
                  Send test now
                </button>

                <button
                  className=
                    "secondary-button"
                  onClick={
                    scheduleTestReminder
                  }
                  type="button"
                >
                  <Clock3 size={18} />
                  Remind me in 5 minutes
                </button>
              </div>

              {notificationMessage && (
                <div className=
                  "notification-message"
                >
                  {notificationMessage}
                </div>
              )}
            </section>

            <section className="panel premium-analytics-panel">
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">
                    Pro analytics
                  </span>

                  <h3>
                    Routine performance
                  </h3>
                </div>

                {canUseAnalytics ? (
                  <div className="feature-access-badge active">
                    <BarChart3 size={15} />
                    Unlocked
                  </div>
                ) : (
                  <div className="feature-access-badge locked">
                    <LockKeyhole size={15} />
                    Pro required
                  </div>
                )}
              </div>

              {canUseAnalytics ? (
                <div className="analytics-grid">
                  <article className="analytics-card">
                    <span>
                      Average completion
                    </span>

                    <strong>
                      {averageCompletion}%
                    </strong>

                    <p>
                      Across days with recorded chores.
                    </p>
                  </article>

                  <article className="analytics-card">
                    <span>
                      Perfect-day rate
                    </span>

                    <strong>
                      {perfectDayRate}%
                    </strong>

                    <p>
                      Days where every chore was completed.
                    </p>
                  </article>

                  <article className="analytics-card">
                    <span>
                      Current streak
                    </span>

                    <strong>
                      {currentStreak}
                    </strong>

                    <p>
                      Consecutive perfect routine days.
                    </p>
                  </article>
                </div>
              ) : (
                <div className="premium-locked-state">
                  <div className="premium-locked-icon">
                    <LockKeyhole size={24} />
                  </div>

                  <div>
                    <h4>
                      Analytics are locked
                    </h4>

                    <p>
                      Upgrade to Pro to unlock completion
                      averages, perfect-day rates, and
                      deeper routine insights.
                    </p>
                  </div>

                  <button
                    className="primary-button"
                    disabled={isCheckoutLoading}
                    onClick={() => {
                      void beginCheckout("pro");
                    }}
                    type="button"
                  >
                    <CreditCard size={18} />
                    Unlock analytics
                  </button>
                </div>
              )}
            </section>
          </div>

          <aside className="sidebar">
            <section className="upgrade-card">
              <div className="upgrade-icon">
                <Sparkles size={24} />
              </div>

              <span className="eyebrow">
                {hasPaidPlan
                  ? "Subscription active"
                  : "Unlock more"}
              </span>

              <h3>
                {hasPaidPlan
                  ? `${plan} plan`
                  : "Upgrade ChoreFlow"}
              </h3>

              <p>
                {hasPaidPlan
                  ? billingStatus
                      ?.cancel_at_period_end
                    ? (
                        "Your subscription will end at the close of the current billing period."
                      )
                    : (
                        "Your paid subscription is active and managed securely through Stripe."
                      )
                  : (
                      "Get unlimited chores, advanced reminders, analytics, and household sharing."
                    )}
              </p>

              {isBillingLoading ? (
                <button
                  className=
                    "primary-button full-width"
                  disabled
                  type="button"
                >
                  <LoaderCircle
                    className=
                      "spinning-icon"
                    size={18}
                  />

                  Loading billing...
                </button>
              ) : hasPaidPlan ? (
                <button
                  className=
                    "primary-button full-width"
                  disabled={
                    isPortalLoading
                  }
                  onClick={() => {
                    void openBillingPortal();
                  }}
                  type="button"
                >
                  {isPortalLoading ? (
                    <LoaderCircle
                      className=
                        "spinning-icon"
                      size={18}
                    />
                  ) : (
                    <ExternalLink
                      size={18}
                    />
                  )}

                  {isPortalLoading
                    ? "Opening Stripe..."
                    : "Manage subscription"}
                </button>
              ) : (
                <button
                  className=
                    "primary-button full-width"
                  disabled={
                    isCheckoutLoading
                  }
                  onClick={() => {
                    void beginCheckout(
                      "pro",
                    );
                  }}
                  type="button"
                >
                  {isCheckoutLoading ? (
                    <LoaderCircle
                      className=
                        "spinning-icon"
                      size={18}
                    />
                  ) : (
                    <CreditCard
                      size={18}
                    />
                  )}

                  {isCheckoutLoading
                    ? "Opening Checkout..."
                    : (
                        "Upgrade to Pro â€” " +
                        "$4.99/month"
                      )}
                </button>
              )}
            </section>

            <section className="plan-card">
              <div className=
                "plan-card-heading"
              >
                <Users size={20} />
                <h3>Your progress</h3>
              </div>

              <p>
                Complete every
                scheduled chore in one
                day to extend your
                streak.
              </p>

              <div className="plan-options">
                <button
                  className="selected"
                  type="button"
                >
                  Current streak

                  <span>
                    {currentStreak}{" "}
                    {currentStreak === 1
                      ? "day"
                      : "days"}
                  </span>
                </button>

                <button type="button">
                  Perfect days

                  <span>
                    {completedDays}
                  </span>
                </button>

                <button type="button">
                  Today

                  <span>
                    {completionPercentage}%
                  </span>
                </button>
              </div>
            </section>

            <section className="plan-card">
              <div className="plan-card-heading">
                <Sparkles size={20} />
                <h3>Plan features</h3>
              </div>

              <p>
                These permissions come directly from
                the protected ChoreFlow feature API.
              </p>

              <div className="feature-list">
                <div className="feature-list-item">
                  <BarChart3 size={18} />

                  <span>Analytics</span>

                  <strong>
                    {canUseAnalytics
                      ? "Unlocked"
                      : "Locked"}
                  </strong>
                </div>

                <div className="feature-list-item">
                  <BellRing size={18} />

                  <span>
                    Advanced reminders
                  </span>

                  <strong>
                    {canUseAdvancedReminders
                      ? "Unlocked"
                      : "Locked"}
                  </strong>
                </div>

                <div className="feature-list-item">
                  <Home size={18} />

                  <span>
                    Household sharing
                  </span>

                  <strong>
                    {canUseHouseholdSharing
                      ? "Unlocked"
                      : "Family"}
                  </strong>
                </div>

                <div className="feature-list-item">
                  <WandSparkles size={18} />

                  <span>AI planning</span>

                  <strong>
                    {canUseAiPlanning
                      ? "Unlocked"
                      : "Coming soon"}
                  </strong>
                </div>
              </div>
            </section>

            <section className="plan-card">
              <div className=
                "plan-card-heading"
              >
                <Crown size={20} />
                <h3>Subscription</h3>
              </div>

              <p>
                Choose a paid plan
                through Stripe or
                manage your existing
                subscription.
              </p>

              {billingError && (
                <div
                  className=
                    "billing-feedback error"
                  role="alert"
                >
                  <span>
                    {billingError}
                  </span>

                  <button
                    onClick={() => {
                      void refreshBillingStatus();
                    }}
                    type="button"
                  >
                    <RefreshCw
                      size={15}
                    />
                    Retry
                  </button>
                </div>
              )}

              {billingMessage && (
                <div className=
                  "billing-feedback success"
                >
                  {billingMessage}
                </div>
              )}

              <div className="plan-options">
                <button
                  className={
                    plan === "free"
                      ? "selected"
                      : ""
                  }
                  disabled
                  type="button"
                >
                  Free
                  <span>$0/month</span>
                </button>

                <button
                  className={
                    plan === "pro"
                      ? "selected"
                      : ""
                  }
                  disabled={
                    isCheckoutLoading ||
                    plan === "pro"
                  }
                  onClick={() => {
                    void beginCheckout(
                      "pro",
                    );
                  }}
                  type="button"
                >
                  Pro

                  <span>
                    {plan === "pro"
                      ? "Current plan"
                      : "$4.99/month"}
                  </span>
                </button>

                <button
                  className={
                    plan === "family"
                      ? "selected"
                      : ""
                  }
                  disabled={
                    isCheckoutLoading ||
                    plan === "family"
                  }
                  onClick={() => {
                    void beginCheckout(
                      "family",
                    );
                  }}
                  type="button"
                >
                  Family

                  <span>
                    {plan === "family"
                      ? "Current plan"
                      : "$9.99/month"}
                  </span>
                </button>
              </div>

              {billingStatus
                ?.current_period_end && (
                <p className=
                  "billing-period-text"
                >
                  Current period ends{" "}
                  {new Date(
                    billingStatus
                      .current_period_end,
                  ).toLocaleDateString()}
                  .
                </p>
              )}

              {billingStatus
                ?.stripe_customer_id && (
                <button
                  className=
                    "secondary-button full-width"
                  disabled={
                    isPortalLoading
                  }
                  onClick={() => {
                    void openBillingPortal();
                  }}
                  type="button"
                >
                  {isPortalLoading ? (
                    <LoaderCircle
                      className=
                        "spinning-icon"
                      size={17}
                    />
                  ) : (
                    <ExternalLink
                      size={17}
                    />
                  )}

                  Manage billing
                </button>
              )}
            </section>
          </aside>
        </section>
      </main>
    </div>
  );
}

