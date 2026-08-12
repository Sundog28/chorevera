import {
  CheckCircle2,
  CirclePlus,
  DoorOpen,
  LoaderCircle,
  Mail,
  Pencil,
  RefreshCw,
  RotateCcw,
  Trash2,
  UserPlus,
  Users,
  XCircle,
} from "lucide-react";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  getHouseholdActivities,
} from "../../api/householdActivities";

import type {
  HouseholdActivity,
  HouseholdActivityAction,
} from "../../types/householdActivity";


interface HouseholdActivityFeedProps {
  refreshIntervalMs?: number;
}


interface ActivityAppearance {
  label: string;
  className: string;
  icon: import("react").ReactNode;
}


function getErrorMessage(
  error: unknown,
): string {
  return error instanceof Error
    ? error.message
    : "Unable to load household activity.";
}


function formatRelativeTime(
  value: string,
): string {
  const activityDate =
    new Date(value);

  const timestamp =
    activityDate.getTime();

  if (Number.isNaN(timestamp)) {
    return "Unknown time";
  }

  const differenceInSeconds =
    Math.round(
      (
        timestamp -
        Date.now()
      ) / 1000,
    );

  const absoluteDifference =
    Math.abs(
      differenceInSeconds,
    );

  const formatter =
    new Intl.RelativeTimeFormat(
      undefined,
      {
        numeric: "auto",
      },
    );

  if (absoluteDifference < 60) {
    return formatter.format(
      differenceInSeconds,
      "second",
    );
  }

  const differenceInMinutes =
    Math.round(
      differenceInSeconds / 60,
    );

  if (
    Math.abs(
      differenceInMinutes,
    ) < 60
  ) {
    return formatter.format(
      differenceInMinutes,
      "minute",
    );
  }

  const differenceInHours =
    Math.round(
      differenceInMinutes / 60,
    );

  if (
    Math.abs(
      differenceInHours,
    ) < 24
  ) {
    return formatter.format(
      differenceInHours,
      "hour",
    );
  }

  const differenceInDays =
    Math.round(
      differenceInHours / 24,
    );

  if (
    Math.abs(
      differenceInDays,
    ) < 7
  ) {
    return formatter.format(
      differenceInDays,
      "day",
    );
  }

  return activityDate.toLocaleDateString(
    undefined,
    {
      month: "short",
      day: "numeric",
      year:
        activityDate.getFullYear() !==
        new Date().getFullYear()
          ? "numeric"
          : undefined,
    },
  );
}


function getActivityAppearance(
  actionType: HouseholdActivityAction,
): ActivityAppearance {
  switch (actionType) {
    case "chore_created":
      return {
        label: "Chore created",
        className: "created",
        icon: <CirclePlus size={18} />,
      };

    case "chore_updated":
      return {
        label: "Chore updated",
        className: "updated",
        icon: <Pencil size={18} />,
      };

    case "chore_completed":
      return {
        label: "Chore completed",
        className: "completed",
        icon: <CheckCircle2 size={18} />,
      };

    case "chore_reopened":
      return {
        label: "Chore reopened",
        className: "reopened",
        icon: <RotateCcw size={18} />,
      };

    case "chore_deleted":
      return {
        label: "Chore deleted",
        className: "deleted",
        icon: <Trash2 size={18} />,
      };

    case "household_created":
      return {
        label: "Household created",
        className: "household",
        icon: <Users size={18} />,
      };

    case "household_renamed":
      return {
        label: "Household renamed",
        className: "updated",
        icon: <Pencil size={18} />,
      };

    case "invitation_sent":
      return {
        label: "Invitation sent",
        className: "invitation",
        icon: <Mail size={18} />,
      };

    case "invitation_declined":
      return {
        label: "Invitation declined",
        className: "declined",
        icon: <XCircle size={18} />,
      };

    case "invitation_cancelled":
      return {
        label: "Invitation cancelled",
        className: "declined",
        icon: <XCircle size={18} />,
      };

    case "member_joined":
      return {
        label: "Member joined",
        className: "member",
        icon: <UserPlus size={18} />,
      };

    case "member_left":
      return {
        label: "Member left",
        className: "member-left",
        icon: <DoorOpen size={18} />,
      };

    default:
      return {
        label: "Household activity",
        className: "default",
        icon: <Users size={18} />,
      };
  }
}


export default function HouseholdActivityFeed({
  refreshIntervalMs = 30_000,
}: HouseholdActivityFeedProps) {
  const [
    activities,
    setActivities,
  ] = useState<HouseholdActivity[]>([]);

  const [
    isLoading,
    setIsLoading,
  ] = useState(true);

  const [
    isRefreshing,
    setIsRefreshing,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");


  const loadActivities =
    useCallback(
      async (
        showFullLoader = false,
      ): Promise<void> => {
        if (showFullLoader) {
          setIsLoading(true);
        } else {
          setIsRefreshing(true);
        }

        setError("");

        try {
          const loadedActivities =
            await getHouseholdActivities();

          setActivities(
            loadedActivities,
          );
        } catch (loadError) {
          setError(
            getErrorMessage(
              loadError,
            ),
          );
        } finally {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      },
      [],
    );


  useEffect(() => {
    void loadActivities(true);
  }, [loadActivities]);


  useEffect(() => {
    const intervalId =
      window.setInterval(
        () => {
          if (
            document.visibilityState ===
            "visible"
          ) {
            void loadActivities(false);
          }
        },
        refreshIntervalMs,
      );

    return () => {
      window.clearInterval(
        intervalId,
      );
    };
  }, [
    loadActivities,
    refreshIntervalMs,
  ]);


  useEffect(() => {
    function handleVisibilityChange() {
      if (
        document.visibilityState ===
        "visible"
      ) {
        void loadActivities(false);
      }
    }

    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange,
    );

    return () => {
      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange,
      );
    };
  }, [loadActivities]);


  const visibleActivities =
    useMemo(
      () =>
        activities.slice(
          0,
          20,
        ),
      [activities],
    );


  return (
    <section className="household-activity-section">
      <div className="command-section-heading">
        <div>
          <span className="eyebrow">
            Recent activity
          </span>

          <h4>
            Household activity
          </h4>
        </div>

        <button
          aria-label="Refresh household activity"
          className="household-activity-refresh"
          disabled={
            isLoading ||
            isRefreshing
          }
          onClick={() => {
            void loadActivities(false);
          }}
          type="button"
        >
          <RefreshCw
            className={
              isRefreshing
                ? "spinning-icon"
                : undefined
            }
            size={18}
          />
        </button>
      </div>

      {isLoading ? (
        <div className="household-activity-state">
          <LoaderCircle
            className="spinning-icon"
            size={30}
          />

          <strong>
            Loading household activity
          </strong>

          <span>
            ChoreFlow is retrieving the
            latest family updates.
          </span>
        </div>
      ) : error ? (
        <div
          className="household-activity-state error"
          role="alert"
        >
          <XCircle size={30} />

          <strong>
            Activity could not be loaded
          </strong>

          <span>
            {error}
          </span>

          <button
            onClick={() => {
              void loadActivities(true);
            }}
            type="button"
          >
            <RefreshCw size={16} />
            Try again
          </button>
        </div>
      ) : visibleActivities.length ===
        0 ? (
        <div className="household-activity-state">
          <Users size={30} />

          <strong>
            No household activity yet
          </strong>

          <span>
            Create or complete a shared
            chore to start the feed.
          </span>
        </div>
      ) : (
        <div className="household-activity-list">
          {visibleActivities.map(
            (activity) => {
              const appearance =
                getActivityAppearance(
                  activity.action_type,
                );

              return (
                <article
                  className="household-activity-item"
                  key={activity.id}
                >
                  <div
                    className={
                      `household-activity-icon ` +
                      appearance.className
                    }
                  >
                    {appearance.icon}
                  </div>

                  <div className="household-activity-copy">
                    <div className="household-activity-meta">
                      <strong>
                        {appearance.label}
                      </strong>

                      <time
                        dateTime={
                          activity.created_at
                        }
                        title={new Date(
                          activity.created_at,
                        ).toLocaleString()}
                      >
                        {formatRelativeTime(
                          activity.created_at,
                        )}
                      </time>
                    </div>

                    <p>
                      {activity.message}
                    </p>
                  </div>
                </article>
              );
            },
          )}
        </div>
      )}
    </section>
  );
}
