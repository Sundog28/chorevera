import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Crown,
  Gauge,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  UserRound,
  Users,
  WandSparkles,
} from "lucide-react";

import {
  type FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  applyHouseholdPlan,
  generateHouseholdPlan,
} from "../api/aiPlanner";

import {
  getFeatureAccess,
} from "../api/features";

import {
  getMyHousehold,
} from "../api/households";

import type {
  AIPlannerResponse,
} from "../types/aiPlanner";

import type {
  FeatureAccess,
} from "../types/features";

import type {
  Household,
} from "../types/household";

import "./AIPlanner.css";


const EXAMPLE_REQUESTS = [
  "We have guests coming Saturday. Get the kitchen, bathrooms, laundry, and living room done beforehand and divide the work fairly.",
  "Rebalance our unfinished chores so nobody is overloaded.",
  "Plan a Friday evening reset with dishes, trash, counters, and vacuuming.",
];


function getErrorMessage(
  error: unknown,
): string {
  return error instanceof Error
    ? error.message
    : "Something went wrong while planning the household.";
}


function formatTime(
  value: string | null,
): string {
  if (!value) {
    return "No reminder";
  }

  const [hours, minutes] =
    value.split(":").map(Number);

  if (
    Number.isNaN(hours) ||
    Number.isNaN(minutes)
  ) {
    return value;
  }

  const date = new Date();
  date.setHours(hours, minutes, 0, 0);

  return date.toLocaleTimeString(
    undefined,
    {
      hour: "numeric",
      minute: "2-digit",
    },
  );
}


export default function AIPlanner() {
  const [
    features,
    setFeatures,
  ] = useState<FeatureAccess | null>(
    null,
  );

  const [
    household,
    setHousehold,
  ] = useState<Household | null>(
    null,
  );

  const [
    requestText,
    setRequestText,
  ] = useState(
    EXAMPLE_REQUESTS[0],
  );

  const [
    maxActions,
    setMaxActions,
  ] = useState(8);

  const [
    plan,
    setPlan,
  ] = useState<AIPlannerResponse | null>(
    null,
  );

  const [
    isLoading,
    setIsLoading,
  ] = useState(true);

  const [
    isGenerating,
    setIsGenerating,
  ] = useState(false);

  const [
    isApplying,
    setIsApplying,
  ] = useState(false);

  const [error, setError] =
    useState("");

  const [message, setMessage] =
    useState("");


  async function loadAccess():
  Promise<void> {
    setIsLoading(true);
    setError("");

    try {
      const [
        loadedFeatures,
        loadedHousehold,
      ] = await Promise.all([
        getFeatureAccess(),
        getMyHousehold(),
      ]);

      setFeatures(loadedFeatures);
      setHousehold(loadedHousehold);
    } catch (loadError) {
      setError(
        getErrorMessage(loadError),
      );
    } finally {
      setIsLoading(false);
    }
  }


  useEffect(() => {
    void loadAccess();
  }, []);


  const memberNameById =
    useMemo(
      () =>
        new Map(
          household?.members.map(
            (member) => [
              member.user_id,
              member.name,
            ],
          ) ?? [],
        ),
      [household],
    );


  const canUseAiPlanning =
    features?.ai_planning ?? false;

  const isOwner =
    household?.current_user_role ===
    "owner";


  async function handleGenerate(
    event: FormEvent,
  ): Promise<void> {
    event.preventDefault();

    if (!household) {
      return;
    }

    const normalized =
      requestText.trim();

    if (normalized.length < 5) {
      setError(
        "Describe what you want the household to accomplish.",
      );
      return;
    }

    setIsGenerating(true);
    setError("");
    setMessage("");

    try {
      const generated =
        await generateHouseholdPlan(
          household.id,
          normalized,
          maxActions,
        );

      setPlan(generated);
    } catch (generateError) {
      setError(
        getErrorMessage(
          generateError,
        ),
      );
    } finally {
      setIsGenerating(false);
    }
  }


  async function handleApply():
  Promise<void> {
    if (
      !household ||
      !plan ||
      plan.actions.length === 0
    ) {
      return;
    }

    setIsApplying(true);
    setError("");
    setMessage("");

    try {
      const result =
        await applyHouseholdPlan(
          household.id,
          plan.actions,
        );

      setMessage(result.message);
      setPlan(null);
    } catch (applyError) {
      setError(
        getErrorMessage(applyError),
      );
    } finally {
      setIsApplying(false);
    }
  }


  if (isLoading) {
    return (
      <main className="ai-planner-page">
        <section className="ai-planner-state-card">
          <LoaderCircle
            className="spinning-icon"
            size={32}
          />

          <strong>
            Loading AI planning access
          </strong>

          <span>
            Checking your household and plan.
          </span>
        </section>
      </main>
    );
  }


  if (!canUseAiPlanning) {
    return (
      <main className="ai-planner-page">
        <section className="ai-planner-locked-card">
          <div className="ai-planner-lock-icon">
            <Crown size={28} />
          </div>

          <span className="eyebrow">
            Family plan
          </span>

          <h1>
            Unlock the AI Household Planner
          </h1>

          <p>
            AI planning uses your real household members, current workload, and recent completion history to propose a structured plan. Upgrade through the Dashboard subscription card to enable it.
          </p>

          {error && (
            <div
              className="ai-planner-feedback error"
              role="alert"
            >
              {error}
            </div>
          )}
        </section>
      </main>
    );
  }


  if (!household) {
    return (
      <main className="ai-planner-page">
        <section className="ai-planner-locked-card">
          <div className="ai-planner-lock-icon">
            <Users size={28} />
          </div>

          <span className="eyebrow">
            Household required
          </span>

          <h1>
            Create your household first
          </h1>

          <p>
            The planner needs a household so it can validate member IDs and balance assignments against real workload data.
          </p>
        </section>
      </main>
    );
  }


  return (
    <main className="ai-planner-page">
      <section className="ai-planner-hero">
        <div>
          <span className="eyebrow">
            AI Household Planner
          </span>

          <h1>
            Turn a goal into a fair household plan.
          </h1>

          <p>
            Describe what needs to happen. The backend combines your request with household members, unfinished chores, current workload, and recent completion history. Nothing changes until you approve the plan.
          </p>
        </div>

        <div className="ai-planner-hero-badge">
          <ShieldCheck size={22} />
          <div>
            <strong>
              Review before apply
            </strong>
            <span>
              Server-side validation
            </span>
          </div>
        </div>
      </section>

      <section className="ai-planner-grid">
        <div className="ai-planner-main-column">
          <section className="ai-planner-panel">
            <div className="ai-planner-panel-heading">
              <div>
                <span className="eyebrow">
                  Natural-language request
                </span>

                <h2>
                  What should the household accomplish?
                </h2>
              </div>

              <WandSparkles size={24} />
            </div>

            <form
              className="ai-planner-form"
              onSubmit={(event) => {
                void handleGenerate(event);
              }}
            >
              <label>
                Planning request

                <textarea
                  disabled={isGenerating}
                  maxLength={1000}
                  onChange={(event) =>
                    setRequestText(
                      event.target.value,
                    )
                  }
                  rows={6}
                  value={requestText}
                />
              </label>

              <div className="ai-planner-form-row">
                <label>
                  Maximum actions

                  <select
                    disabled={isGenerating}
                    onChange={(event) =>
                      setMaxActions(
                        Number(
                          event.target.value,
                        ),
                      )
                    }
                    value={maxActions}
                  >
                    {[6, 8, 10, 12].map(
                      (value) => (
                        <option
                          key={value}
                          value={value}
                        >
                          {value}
                        </option>
                      ),
                    )}
                  </select>
                </label>

                <button
                  className="ai-planner-primary-button"
                  disabled={
                    isGenerating ||
                    requestText.trim().length <
                      5
                  }
                  type="submit"
                >
                  {isGenerating ? (
                    <LoaderCircle
                      className="spinning-icon"
                      size={18}
                    />
                  ) : (
                    <Sparkles size={18} />
                  )}

                  {isGenerating
                    ? "Generating plan..."
                    : "Generate plan"}
                </button>
              </div>
            </form>

            <div className="ai-planner-examples">
              <span>Try an example:</span>

              {EXAMPLE_REQUESTS.map(
                (example, index) => (
                  <button
                    disabled={isGenerating}
                    key={example}
                    onClick={() =>
                      setRequestText(example)
                    }
                    type="button"
                  >
                    Example {index + 1}
                  </button>
                ),
              )}
            </div>

            {error && (
              <div
                className="ai-planner-feedback error"
                role="alert"
              >
                <AlertTriangle size={18} />
                {error}
              </div>
            )}

            {message && (
              <div
                className="ai-planner-feedback success"
                role="status"
              >
                <CheckCircle2 size={18} />
                {message}
              </div>
            )}
          </section>

          {plan && (
            <section className="ai-planner-panel ai-plan-results">
              <div className="ai-planner-panel-heading">
                <div>
                  <span className="eyebrow">
                    Proposed plan
                  </span>

                  <h2>
                    Review every action
                  </h2>
                </div>

                <div
                  className={
                    `ai-provider-badge ${plan.provider}`
                  }
                >
                  {plan.provider ===
                  "openai"
                    ? "OpenAI"
                    : "Safe fallback"}
                </div>
              </div>

              <div className="ai-plan-summary">
                <strong>{plan.summary}</strong>
                <p>{plan.fairness_notes}</p>
              </div>

              {plan.provider ===
                "fallback" && (
                <div className="ai-planner-feedback warning">
                  <AlertTriangle size={18} />
                  The model provider was unavailable or its output failed semantic validation. Fallback mode only rebalances existing incomplete chores.
                </div>
              )}

              <div className="ai-plan-actions">
                {plan.actions.length === 0 ? (
                  <div className="ai-plan-empty">
                    <CheckCircle2 size={28} />
                    <strong>
                      No changes proposed
                    </strong>
                    <span>
                      The plan did not identify any safe database actions.
                    </span>
                  </div>
                ) : (
                  plan.actions.map(
                    (action, index) => (
                      <article
                        className="ai-plan-action-card"
                        key={
                          `${action.action}-${action.existing_chore_id ?? action.title}-${index}`
                        }
                      >
                        <div className="ai-plan-action-number">
                          {index + 1}
                        </div>

                        <div className="ai-plan-action-content">
                          <div className="ai-plan-action-title-row">
                            <strong>
                              {action.title}
                            </strong>

                            <span
                              className={
                                `ai-priority ${action.priority}`
                              }
                            >
                              {action.priority}
                            </span>
                          </div>

                          <div className="ai-plan-action-meta">
                            <span>
                              <UserRound size={15} />
                              {memberNameById.get(
                                action.assigned_user_id,
                              ) ??
                                `User ${action.assigned_user_id}`}
                            </span>

                            <span>
                              <Clock3 size={15} />
                              {formatTime(
                                action.reminder_time,
                              )}
                            </span>

                            <span>
                              {action.action ===
                              "create"
                                ? "New chore"
                                : `Reassign chore #${action.existing_chore_id}`}
                            </span>
                          </div>

                          <p>
                            {action.rationale}
                          </p>
                        </div>
                      </article>
                    ),
                  )
                )}
              </div>

              {plan.assumptions.length >
                0 && (
                <div className="ai-plan-assumptions">
                  <strong>
                    Assumptions
                  </strong>

                  <ul>
                    {plan.assumptions.map(
                      (assumption) => (
                        <li key={assumption}>
                          {assumption}
                        </li>
                      ),
                    )}
                  </ul>
                </div>
              )}

              <div className="ai-plan-approval-bar">
                <div>
                  <ShieldCheck size={19} />
                  <span>
                    {isOwner
                      ? "Applying revalidates every member and chore ID on the server."
                      : "Only the household owner can apply a proposed plan."}
                  </span>
                </div>

                <button
                  className="ai-planner-primary-button"
                  disabled={
                    !isOwner ||
                    isApplying ||
                    plan.actions.length === 0
                  }
                  onClick={() => {
                    void handleApply();
                  }}
                  type="button"
                >
                  {isApplying ? (
                    <LoaderCircle
                      className="spinning-icon"
                      size={18}
                    />
                  ) : (
                    <CheckCircle2
                      size={18}
                    />
                  )}

                  {isApplying
                    ? "Applying..."
                    : "Approve and apply"}
                </button>
              </div>
            </section>
          )}
        </div>

        <aside className="ai-planner-sidebar">
          <section className="ai-planner-panel">
            <div className="ai-planner-side-heading">
              <Users size={20} />
              <h3>{household.name}</h3>
            </div>

            <p>
              {household.member_count}{" "}
              {household.member_count === 1
                ? "member"
                : "members"}
            </p>

            <div className="ai-planner-member-list">
              {household.members.map(
                (member) => (
                  <div key={member.user_id}>
                    <UserRound size={16} />
                    <span>{member.name}</span>
                    <strong>
                      {member.role}
                    </strong>
                  </div>
                ),
              )}
            </div>
          </section>

          {plan && (
            <section className="ai-planner-panel">
              <div className="ai-planner-side-heading">
                <Gauge size={20} />
                <h3>Projected workload</h3>
              </div>

              <div className="ai-workload-list">
                {plan.workloads.map(
                  (workload) => (
                    <article
                      key={workload.user_id}
                    >
                      <div>
                        <strong>
                          {workload.name}
                        </strong>
                        <span>
                          {workload.recent_completed}{" "}
                          completed recently
                        </span>
                      </div>

                      <div className="ai-workload-values">
                        <span>
                          {workload.current_incomplete}
                        </span>
                        <span>→</span>
                        <strong>
                          {workload.projected_incomplete}
                        </strong>
                      </div>
                    </article>
                  ),
                )}
              </div>

              <div className="ai-confidence-meter">
                <span>
                  Plan confidence
                </span>
                <strong>
                  {plan.confidence}%
                </strong>
              </div>
            </section>
          )}

          <section className="ai-planner-panel ai-safety-card">
            <div className="ai-planner-side-heading">
              <ShieldCheck size={20} />
              <h3>Safety layer</h3>
            </div>

            <ul>
              <li>
                Member IDs must belong to this household.
              </li>
              <li>
                Existing chore IDs must be current and incomplete.
              </li>
              <li>
                The AI cannot delete chores.
              </li>
              <li>
                Database changes require explicit owner approval.
              </li>
            </ul>
          </section>

          <button
            className="ai-planner-refresh-button"
            onClick={() => {
              void loadAccess();
            }}
            type="button"
          >
            <RefreshCw size={16} />
            Refresh household access
          </button>
        </aside>
      </section>
    </main>
  );
}
