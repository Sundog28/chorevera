import {
  AlertTriangle,
  BellRing,
  UserRound,
  Users,
  WandSparkles,
} from "lucide-react";

import "./HouseholdCommandCenter.css";


export type HouseholdCommandMember = {
  name: string;
  remainingCount: number;
};


type HouseholdCommandCenterProps = {
  householdCompletionPercentage: number;
  householdRemainingCount: number;
  unassignedChoreCount: number;
  activeAlertCount: number;
  mostOverloadedMember:
    HouseholdCommandMember | null;
  isHouseholdOwner: boolean;

  onAutoBalance: () => void;
  onReviewAssignments: () => void;
  onSendReminder: () => void;
};


function getHealthLabel(
  percentage: number,
): string {
  if (percentage >= 80) {
    return "On track";
  }

  if (percentage >= 40) {
    return "Needs attention";
  }

  return "Action recommended";
}


function getHealthClass(
  percentage: number,
): string {
  if (percentage >= 80) {
    return "healthy";
  }

  if (percentage >= 40) {
    return "warning";
  }

  return "critical";
}


export default function HouseholdCommandCenter({
  householdCompletionPercentage,
  householdRemainingCount,
  unassignedChoreCount,
  activeAlertCount,
  mostOverloadedMember,
  isHouseholdOwner,
  onAutoBalance,
  onReviewAssignments,
  onSendReminder,
}: HouseholdCommandCenterProps) {
  const recommendation =
    unassignedChoreCount > 0
      ? (
          `Auto-assign ${unassignedChoreCount} ` +
          `${
            unassignedChoreCount === 1
              ? "unassigned chore"
              : "unassigned chores"
          } to balance the household workload.`
        )
      : mostOverloadedMember
        ? (
            `Review ${mostOverloadedMember.name}’s ` +
            `remaining assignments and consider rebalancing.`
          )
        : householdRemainingCount > 0
          ? (
              "Send a reminder to help the household finish today’s routine."
            )
          : (
              "The household is caught up. Celebrate the team’s progress."
            );

  return (
    <section className="household-action-center">
      <div className="household-action-heading">
        <div>
          <span className="eyebrow">
            Action center
          </span>

          <h4>
            What needs attention
          </h4>

          <p>
            Review household priorities and take
            action without leaving the dashboard.
          </p>
        </div>

        <div
          className={
            `household-health-status ` +
            `${getHealthClass(
              householdCompletionPercentage,
            )}`
          }
        >
          <span>
            Household health
          </span>

          <strong>
            {getHealthLabel(
              householdCompletionPercentage,
            )}
          </strong>
        </div>
      </div>

      <div className="household-priority-grid">
        <article
          className={
            householdRemainingCount > 0
              ? "priority-warning"
              : "priority-success"
          }
        >
          <div className="priority-icon">
            <AlertTriangle size={19} />
          </div>

          <div>
            <span>
              Unfinished chores
            </span>

            <strong>
              {householdRemainingCount}
            </strong>

            <p>
              {householdRemainingCount === 0
                ? "Everyone is caught up."
                : "Across all household members."}
            </p>
          </div>
        </article>

        <article
          className={
            unassignedChoreCount > 0
              ? "priority-warning"
              : "priority-success"
          }
        >
          <div className="priority-icon">
            <Users size={19} />
          </div>

          <div>
            <span>
              Unassigned chores
            </span>

            <strong>
              {unassignedChoreCount}
            </strong>

            <p>
              {unassignedChoreCount === 0
                ? "Every chore has an owner."
                : "Ready for fair auto-assignment."}
            </p>
          </div>
        </article>

        <article
          className={
            mostOverloadedMember
              ? "priority-warning"
              : "priority-success"
          }
        >
          <div className="priority-icon">
            <UserRound size={19} />
          </div>

          <div>
            <span>
              Highest workload
            </span>

            <strong>
              {mostOverloadedMember?.name ??
                "Balanced"}
            </strong>

            <p>
              {mostOverloadedMember
                ? (
                    `${mostOverloadedMember.remainingCount} ` +
                    `${
                      mostOverloadedMember.remainingCount ===
                      1
                        ? "chore"
                        : "chores"
                    } remaining`
                  )
                : "No member is falling behind."}
            </p>
          </div>
        </article>

        <article
          className={
            activeAlertCount > 0
              ? "priority-warning"
              : "priority-success"
          }
        >
          <div className="priority-icon">
            <BellRing size={19} />
          </div>

          <div>
            <span>
              Active alerts
            </span>

            <strong>
              {activeAlertCount}
            </strong>

            <p>
              {activeAlertCount === 0
                ? "No action is required."
                : "Review the recommended actions."}
            </p>
          </div>
        </article>
      </div>

      <div className="household-recommendation">
        <div className="household-recommendation-icon">
          <WandSparkles size={21} />
        </div>

        <div>
          <strong>
            Recommended next step
          </strong>

          <p>{recommendation}</p>
        </div>
      </div>

      <div className="household-action-buttons">
        <button
          className="household-command-primary"
          disabled={!isHouseholdOwner}
          onClick={onAutoBalance}
          type="button"
        >
          <WandSparkles size={17} />
          Auto-balance workload
        </button>

        <button
          className="household-command-secondary"
          onClick={onReviewAssignments}
          type="button"
        >
          <Users size={17} />
          Review assignments
        </button>

        <button
          className="household-command-secondary"
          disabled={
            householdRemainingCount === 0
          }
          onClick={onSendReminder}
          type="button"
        >
          <BellRing size={17} />
          Send reminder
        </button>
      </div>

      {!isHouseholdOwner && (
        <p className="household-command-note">
          Auto-balancing is available to the
          household owner. Members can still review
          assignments and reminders.
        </p>
      )}
    </section>
  );
}
