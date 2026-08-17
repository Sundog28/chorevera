import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Activity,
  BarChart3,
  Check,
  Clock3,
  Crown,
  Home,
  LoaderCircle,
  LogOut,
  Mail,
  Pencil,
  Plus,
  RefreshCw,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  UserRound,
  Users,
  X,
} from "lucide-react";

import {
  acceptInvitation,
  cancelInvitation,
  createHousehold,
  declineInvitation,
  deleteHousehold,
  getHouseholdActivities,
  getMyHousehold,
  getMyInvitations,
  getSentInvitations,
  inviteHouseholdMember,
  leaveHousehold,
  updateHousehold,
} from "../api/households";

import { useBilling } from "../context/BillingContext";
import { useFeatures } from "../context/FeatureContext";

import type {
  Household as HouseholdType,
  HouseholdActivity,
  HouseholdInvitation,
} from "../types/household";


function getErrorMessage(
  error: unknown,
  fallback: string,
): string {
  return error instanceof Error
    ? error.message
    : fallback;
}


function formatRelativeTime(
  value: string,
): string {
  const difference =
    Date.now() -
    new Date(value).getTime();

  const minutes =
    Math.max(
      1,
      Math.round(
        difference /
        60_000,
      ),
    );

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours =
    Math.round(
      minutes / 60,
    );

  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days =
    Math.round(
      hours / 24,
    );

  return `${days}d ago`;
}


function formatDate(
  value: string,
): string {
  return new Date(value).toLocaleDateString(
    undefined,
    {
      month: "short",
      day: "numeric",
      year: "numeric",
    },
  );
}


export default function Household() {
  const {
    features,
    canUseHouseholdSharing,
    isFeaturesLoading,
    refreshFeatures,
  } = useFeatures();

  const {
    isCheckoutLoading,
    beginCheckout,
  } = useBilling();

  const [household, setHousehold] =
    useState<HouseholdType | null>(null);

  const [
    sentInvitations,
    setSentInvitations,
  ] = useState<HouseholdInvitation[]>([]);

  const [
    receivedInvitations,
    setReceivedInvitations,
  ] = useState<HouseholdInvitation[]>([]);

  const [
    householdActivities,
    setHouseholdActivities,
  ] = useState<HouseholdActivity[]>([]);

  const [
    householdAccent,
    setHouseholdAccent,
  ] = useState(
    () =>
      localStorage.getItem(
        "choreflow-household-accent",
      ) ?? "violet",
  );

  const [
    compactMemberView,
    setCompactMemberView,
  ] = useState(
    () =>
      localStorage.getItem(
        "choreflow-household-compact",
      ) === "true",
  );

  const [householdName, setHouseholdName] =
    useState("");

  const [editedName, setEditedName] =
    useState("");

  const [inviteEmail, setInviteEmail] =
    useState("");

  const [isLoading, setIsLoading] =
    useState(true);

  const [isSaving, setIsSaving] =
    useState(false);

  const [pendingActionId, setPendingActionId] =
    useState<number | null>(null);

  const [isEditingName, setIsEditingName] =
    useState(false);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");


  const loadHouseholdWorkspace =
    useCallback(async (): Promise<void> => {
      setIsLoading(true);
      setError("");

      try {
        const [
          loadedHousehold,
          loadedSentInvitations,
          loadedReceivedInvitations,
          loadedActivities,
        ] = await Promise.all([
          getMyHousehold(),
          getSentInvitations(),
          getMyInvitations(),
          getHouseholdActivities(
            50,
          ).catch(
            () => [],
          ),
        ]);

        setHousehold(loadedHousehold);

        setSentInvitations(
          loadedSentInvitations,
        );

        setReceivedInvitations(
          loadedReceivedInvitations,
        );

        setHouseholdActivities(
          loadedActivities,
        );

        if (loadedHousehold) {
          setEditedName(
            loadedHousehold.name,
          );
        }
      } catch (loadError) {
        setError(
          getErrorMessage(
            loadError,
            "Unable to load your household.",
          ),
        );
      } finally {
        setIsLoading(false);
      }
    }, []);


  useEffect(() => {
    void loadHouseholdWorkspace();
  }, [loadHouseholdWorkspace]);


  const pendingSentInvitations =
    useMemo(
      () =>
        sentInvitations.filter(
          (invitation) =>
            invitation.status ===
            "pending",
        ),
      [sentInvitations],
    );

  const pendingReceivedInvitations =
    useMemo(
      () =>
        receivedInvitations.filter(
          (invitation) =>
            invitation.status ===
            "pending",
        ),
      [receivedInvitations],
    );

  const isOwner =
    household?.current_user_role ===
    "owner";

  const invitationHistory =
    useMemo(
      () =>
        [...sentInvitations]
          .filter(
            (invitation) =>
              invitation.status !==
              "pending",
          )
          .sort(
            (first, second) =>
              new Date(
                second.responded_at ??
                  second.created_at,
              ).getTime() -
              new Date(
                first.responded_at ??
                  first.created_at,
              ).getTime(),
          ),
      [sentInvitations],
    );

  const recentActivities =
    useMemo(
      () =>
        householdActivities.slice(
          0,
          8,
        ),
      [householdActivities],
    );

  const ownerCount =
    household?.members.filter(
      (member) =>
        member.role === "owner",
    ).length ?? 0;

  const newestMember =
    household
      ? [...household.members].sort(
          (first, second) =>
            new Date(
              second.joined_at,
            ).getTime() -
            new Date(
              first.joined_at,
            ).getTime(),
        )[0] ?? null
      : null;

  useEffect(() => {
    localStorage.setItem(
      "choreflow-household-accent",
      householdAccent,
    );
  }, [householdAccent]);

  useEffect(() => {
    localStorage.setItem(
      "choreflow-household-compact",
      String(
        compactMemberView,
      ),
    );
  }, [compactMemberView]);


  async function handleCreateHousehold(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();

    const trimmedName =
      householdName.trim();

    if (!trimmedName || isSaving) {
      return;
    }

    setIsSaving(true);
    setError("");
    setMessage("");

    try {
      const createdHousehold =
        await createHousehold(
          trimmedName,
        );

      setHousehold(
        createdHousehold,
      );

      setEditedName(
        createdHousehold.name,
      );

      setHouseholdName("");

      setMessage(
        "Your household was created.",
      );

      await refreshFeatures();
    } catch (createError) {
      setError(
        getErrorMessage(
          createError,
          "Unable to create the household.",
        ),
      );
    } finally {
      setIsSaving(false);
    }
  }


  async function handleRenameHousehold(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();

    if (!household) {
      return;
    }

    const trimmedName =
      editedName.trim();

    if (!trimmedName || isSaving) {
      return;
    }

    setIsSaving(true);
    setError("");
    setMessage("");

    try {
      const updatedHousehold =
        await updateHousehold(
          household.id,
          trimmedName,
        );

      setHousehold(
        updatedHousehold,
      );

      setEditedName(
        updatedHousehold.name,
      );

      setIsEditingName(false);

      setMessage(
        "Household name updated.",
      );
    } catch (updateError) {
      setError(
        getErrorMessage(
          updateError,
          "Unable to update the household.",
        ),
      );
    } finally {
      setIsSaving(false);
    }
  }


  async function handleInviteMember(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();

    const normalizedEmail =
      inviteEmail.trim().toLowerCase();

    if (!normalizedEmail || isSaving) {
      return;
    }

    setIsSaving(true);
    setError("");
    setMessage("");

    try {
      const invitation =
        await inviteHouseholdMember(
          normalizedEmail,
        );

      setSentInvitations(
        (currentInvitations) => [
          invitation,
          ...currentInvitations,
        ],
      );

      setInviteEmail("");

      setMessage(
        `Invitation sent to ${invitation.invited_email}.`,
      );
    } catch (inviteError) {
      setError(
        getErrorMessage(
          inviteError,
          "Unable to send the invitation.",
        ),
      );
    } finally {
      setIsSaving(false);
    }
  }


  async function handleAcceptInvitation(
    invitationId: number,
  ): Promise<void> {
    setPendingActionId(
      invitationId,
    );

    setError("");
    setMessage("");

    try {
      await acceptInvitation(
        invitationId,
      );

      setMessage(
        "Invitation accepted. You joined the household.",
      );

      await loadHouseholdWorkspace();
    } catch (acceptError) {
      setError(
        getErrorMessage(
          acceptError,
          "Unable to accept the invitation.",
        ),
      );
    } finally {
      setPendingActionId(null);
    }
  }


  async function handleDeclineInvitation(
    invitationId: number,
  ): Promise<void> {
    setPendingActionId(
      invitationId,
    );

    setError("");
    setMessage("");

    try {
      const response =
        await declineInvitation(
          invitationId,
        );

      setReceivedInvitations(
        (currentInvitations) =>
          currentInvitations.map(
            (invitation) =>
              invitation.id ===
              invitationId
                ? response.invitation
                : invitation,
          ),
      );

      setMessage(
        "Invitation declined.",
      );
    } catch (declineError) {
      setError(
        getErrorMessage(
          declineError,
          "Unable to decline the invitation.",
        ),
      );
    } finally {
      setPendingActionId(null);
    }
  }


  async function handleCancelInvitation(
    invitationId: number,
  ): Promise<void> {
    setPendingActionId(
      invitationId,
    );

    setError("");
    setMessage("");

    try {
      await cancelInvitation(
        invitationId,
      );

      setSentInvitations(
        (currentInvitations) =>
          currentInvitations.filter(
            (invitation) =>
              invitation.id !==
              invitationId,
          ),
      );

      setMessage(
        "Invitation cancelled.",
      );
    } catch (cancelError) {
      setError(
        getErrorMessage(
          cancelError,
          "Unable to cancel the invitation.",
        ),
      );
    } finally {
      setPendingActionId(null);
    }
  }


  async function handleDeleteHousehold():
  Promise<void> {
    if (!household || !isOwner) {
      return;
    }

    const confirmed =
      window.confirm(
        `Delete "${household.name}"? ` +
        "This removes all household memberships.",
      );

    if (!confirmed) {
      return;
    }

    setIsSaving(true);
    setError("");
    setMessage("");

    try {
      await deleteHousehold(
        household.id,
      );

      setHousehold(null);
      setSentInvitations([]);

      setMessage(
        "Household deleted.",
      );
    } catch (deleteError) {
      setError(
        getErrorMessage(
          deleteError,
          "Unable to delete the household.",
        ),
      );
    } finally {
      setIsSaving(false);
    }
  }


  async function handleLeaveHousehold():
  Promise<void> {
    if (!household || isOwner) {
      return;
    }

    const confirmed =
      window.confirm(
        `Leave "${household.name}"?`,
      );

    if (!confirmed) {
      return;
    }

    setIsSaving(true);
    setError("");
    setMessage("");

    try {
      await leaveHousehold(
        household.id,
      );

      setHousehold(null);

      setMessage(
        "You left the household.",
      );
    } catch (leaveError) {
      setError(
        getErrorMessage(
          leaveError,
          "Unable to leave the household.",
        ),
      );
    } finally {
      setIsSaving(false);
    }
  }


  if (
    isLoading ||
    isFeaturesLoading
  ) {
    return (
      <main
      className={
        `household-page ` +
        `household-accent-${householdAccent}`
      }
    >
        <section className="household-loading">
          <LoaderCircle
            className="spinning-icon"
            size={42}
          />

          <h2>
            Loading your household
          </h2>

          <p>
            Chorevera is synchronizing
            members and invitations.
          </p>
        </section>
      </main>
    );
  }


  return (
    <main
      className={
        `household-page ` +
        `household-accent-${householdAccent}`
      }
    >
      <section className="household-hero">
        <div>
          <span className="eyebrow">
            Family workspace
          </span>

          <h1>
            {household
              ? household.name
              : "Build your household"}
          </h1>

          <p>
            Create a shared space,
            invite family members, and
            prepare to assign chores
            across your household.
          </p>
        </div>

        <div className="household-hero-icon">
          <Home size={34} />
        </div>
      </section>

      {error && (
        <div
          className="household-feedback error"
          role="alert"
        >
          <span>{error}</span>

          <button
            onClick={() => {
              void loadHouseholdWorkspace();
            }}
            type="button"
          >
            <RefreshCw size={16} />
            Retry
          </button>
        </div>
      )}

      {message && (
        <div className="household-feedback success">
          <Check size={17} />
          {message}
        </div>
      )}

      {pendingReceivedInvitations.length >
        0 && (
        <section className="household-panel">
          <div className="household-panel-heading">
            <div>
              <span className="eyebrow">
                Invitations
              </span>

              <h2>
                You've been invited
              </h2>
            </div>

            <Mail size={22} />
          </div>

          <div className="invitation-list">
            {pendingReceivedInvitations.map(
              (invitation) => (
                <article
                  className="invitation-card"
                  key={invitation.id}
                >
                  <div>
                    <strong>
                      {
                        invitation.household_name
                      }
                    </strong>

                    <span>
                      Invited by{" "}
                      {
                        invitation.invited_by_name
                      }
                    </span>
                  </div>

                  <div className="invitation-actions">
                    <button
                      className="household-secondary-button"
                      disabled={
                        pendingActionId ===
                        invitation.id
                      }
                      onClick={() => {
                        void handleDeclineInvitation(
                          invitation.id,
                        );
                      }}
                      type="button"
                    >
                      <X size={16} />
                      Decline
                    </button>

                    <button
                      className="household-primary-button"
                      disabled={
                        pendingActionId ===
                        invitation.id
                      }
                      onClick={() => {
                        void handleAcceptInvitation(
                          invitation.id,
                        );
                      }}
                      type="button"
                    >
                      {pendingActionId ===
                      invitation.id ? (
                        <LoaderCircle
                          className="spinning-icon"
                          size={16}
                        />
                      ) : (
                        <Check size={16} />
                      )}

                      Accept
                    </button>
                  </div>
                </article>
              ),
            )}
          </div>
        </section>
      )}

      {!canUseHouseholdSharing &&
      !household ? (
        <section className="family-upgrade-card">
          <div className="family-upgrade-icon">
            <Crown size={28} />
          </div>

          <span className="eyebrow">
            Family plan
          </span>

          <h2>
            Unlock household sharing
          </h2>

          <p>
            Create a shared household,
            invite family members, and
            manage collaborative chores
            with the Family plan.
          </p>

          <button
            className="household-primary-button"
            disabled={
              isCheckoutLoading
            }
            onClick={() => {
              void beginCheckout(
                "family",
              );
            }}
            type="button"
          >
            {isCheckoutLoading ? (
              <LoaderCircle
                className="spinning-icon"
                size={18}
              />
            ) : (
              <Crown size={18} />
            )}

            Upgrade to Family —
            $9.99/month
          </button>

          <p className="family-plan-label">
            Current plan:{" "}
            {features?.plan_name ??
              "free"}
          </p>
        </section>
      ) : !household ? (
        <section className="household-panel create-household-panel">
          <div className="household-panel-heading">
            <div>
              <span className="eyebrow">
                Get started
              </span>

              <h2>
                Create your household
              </h2>
            </div>

            <Home size={24} />
          </div>

          <p>
            Choose a name such as
            â€œTreen Householdâ€ or
            â€œThe Smith Family.â€
          </p>

          <form
            className="household-form"
            onSubmit={
              handleCreateHousehold
            }
          >
            <label>
              Household name

              <input
                disabled={isSaving}
                maxLength={100}
                onChange={(event) =>
                  setHouseholdName(
                    event.target.value,
                  )
                }
                placeholder="Example: Treen Household"
                type="text"
                value={householdName}
              />
            </label>

            <button
              className="household-primary-button"
              disabled={
                isSaving ||
                !householdName.trim()
              }
              type="submit"
            >
              {isSaving ? (
                <LoaderCircle
                  className="spinning-icon"
                  size={18}
                />
              ) : (
                <Plus size={18} />
              )}

              Create household
            </button>
          </form>
        </section>
      ) : (
        <section className="household-grid">
          <div className="household-main-column">
            <section className="household-panel">
              <div className="household-panel-heading">
                <div>
                  <span className="eyebrow">
                    Household
                  </span>

                  {isEditingName ? (
                    <form
                      className="household-name-form"
                      onSubmit={
                        handleRenameHousehold
                      }
                    >
                      <input
                        autoFocus
                        disabled={isSaving}
                        maxLength={100}
                        onChange={(event) =>
                          setEditedName(
                            event.target.value,
                          )
                        }
                        value={editedName}
                      />

                      <button
                        aria-label="Save household name"
                        disabled={isSaving}
                        type="submit"
                      >
                        <Check size={17} />
                      </button>

                      <button
                        aria-label="Cancel household edit"
                        onClick={() => {
                          setEditedName(
                            household.name,
                          );

                          setIsEditingName(
                            false,
                          );
                        }}
                        type="button"
                      >
                        <X size={17} />
                      </button>
                    </form>
                  ) : (
                    <h2>
                      {household.name}
                    </h2>
                  )}
                </div>

                {isOwner &&
                  !isEditingName && (
                    <button
                      className="household-icon-button"
                      onClick={() =>
                        setIsEditingName(
                          true,
                        )
                      }
                      type="button"
                    >
                      <Pencil size={17} />
                    </button>
                  )}
              </div>

              <div className="household-summary-grid">
                <article>
                  <Users size={20} />
                  <span>Members</span>
                  <strong>
                    {
                      household.member_count
                    }
                  </strong>
                </article>

                <article>
                  <ShieldCheck size={20} />
                  <span>Your role</span>
                  <strong>
                    {
                      household.current_user_role
                    }
                  </strong>
                </article>

                <article>
                  <Home size={20} />
                  <span>Created</span>
                  <strong>
                    {formatDate(
                      household.created_at,
                    )}
                  </strong>
                </article>
              </div>
            </section>

            <section className="household-panel household-management-overview">
              <div className="household-panel-heading">
                <div>
                  <span className="eyebrow">
                    Management
                  </span>

                  <h2>
                    Household overview
                  </h2>
                </div>

                <BarChart3 size={22} />
              </div>

              <div className="household-management-stats">
                <article>
                  <Users size={19} />

                  <span>
                    Active members
                  </span>

                  <strong>
                    {household.member_count}
                  </strong>
                </article>

                <article>
                  <ShieldCheck size={19} />

                  <span>
                    Owners
                  </span>

                  <strong>
                    {ownerCount}
                  </strong>
                </article>

                <article>
                  <Mail size={19} />

                  <span>
                    Pending invites
                  </span>

                  <strong>
                    {
                      pendingSentInvitations.length
                    }
                  </strong>
                </article>

                <article>
                  <Clock3 size={19} />

                  <span>
                    Newest member
                  </span>

                  <strong>
                    {newestMember?.name ??
                      "No members"}
                  </strong>
                </article>
              </div>
            </section>

            <section className="household-panel">
              <div className="household-panel-heading">
                <div>
                  <span className="eyebrow">
                    Permissions
                  </span>

                  <h2>
                    Roles and access
                  </h2>
                </div>

                <ShieldCheck size={22} />
              </div>

              <div className="permission-matrix">
                <div className="permission-matrix-header">
                  <span>Permission</span>
                  <span>Owner</span>
                  <span>Member</span>
                </div>

                {[
                  [
                    "Rename household",
                    true,
                    false,
                  ],
                  [
                    "Invite members",
                    true,
                    false,
                  ],
                  [
                    "Manage household chores",
                    true,
                    false,
                  ],
                  [
                    "Complete assigned chores",
                    true,
                    true,
                  ],
                  [
                    "View household progress",
                    true,
                    true,
                  ],
                ].map(
                  ([
                    label,
                    ownerAllowed,
                    memberAllowed,
                  ]) => (
                    <div
                      className="permission-matrix-row"
                      key={String(label)}
                    >
                      <span>
                        {String(label)}
                      </span>

                      <strong>
                        {ownerAllowed
                          ? "Allowed"
                          : "—"}
                      </strong>

                      <strong>
                        {memberAllowed
                          ? "Allowed"
                          : "—"}
                      </strong>
                    </div>
                  ),
                )}
              </div>

              <p className="household-management-note">
                Chorevera currently supports
                Owner and Member roles. Additional
                role editing requires a matching
                backend permission endpoint.
              </p>
            </section>

            <section className="household-panel">
              <div className="household-panel-heading">
                <div>
                  <span className="eyebrow">
                    Members
                  </span>

                  <h2>
                    Household members
                  </h2>
                </div>

                <Users size={23} />
              </div>

              <div
                className={
                  `member-list ` +
                  `${
                    compactMemberView
                      ? "compact"
                      : ""
                  }`
                }
              >
                {household.members.map(
                  (member) => (
                    <article
                      className="member-card"
                      key={
                        member.membership_id
                      }
                    >
                      <div className="member-avatar">
                        <UserRound
                          size={20}
                        />
                      </div>

                      <div className="member-details">
                        <strong>
                          {member.name}
                        </strong>

                        <span>
                          {member.email}
                        </span>
                      </div>

                      <div
                        className={
                          `member-role ` +
                          `${member.role}`
                        }
                      >
                        {member.role}
                      </div>
                    </article>
                  ),
                )}
              </div>
            </section>

            <section className="household-panel">
              <div className="household-panel-heading">
                <div>
                  <span className="eyebrow">
                    Recent activity
                  </span>

                  <h2>
                    Member activity
                  </h2>
                </div>

                <Activity size={22} />
              </div>

              {recentActivities.length ===
              0 ? (
                <div className="household-empty-state">
                  <Activity size={28} />

                  <strong>
                    No recent activity
                  </strong>

                  <span>
                    Household actions will appear
                    here.
                  </span>
                </div>
              ) : (
                <div className="household-activity-list">
                  {recentActivities.map(
                    (activity) => (
                      <article
                        key={activity.id}
                      >
                        <div className="household-activity-icon">
                          <Activity size={16} />
                        </div>

                        <div>
                          <strong>
                            {activity.actor_name}
                          </strong>

                          <p>
                            {activity.message}
                          </p>
                        </div>

                        <time
                          dateTime={
                            activity.created_at
                          }
                        >
                          {formatRelativeTime(
                            activity.created_at,
                          )}
                        </time>
                      </article>
                    ),
                  )}
                </div>
              )}
            </section>

            {isOwner && (
              <section className="household-panel">
                <div className="household-panel-heading">
                  <div>
                    <span className="eyebrow">
                      Invitation history
                    </span>

                    <h2>
                      Past invitations
                    </h2>
                  </div>

                  <Mail size={22} />
                </div>

                {invitationHistory.length ===
                0 ? (
                  <div className="household-empty-state">
                    <Mail size={28} />

                    <strong>
                      No invitation history
                    </strong>

                    <span>
                      Accepted, declined, and
                      cancelled invitations will
                      appear here.
                    </span>
                  </div>
                ) : (
                  <div className="invitation-history-list">
                    {invitationHistory.map(
                      (invitation) => (
                        <article
                          key={invitation.id}
                        >
                          <div>
                            <strong>
                              {
                                invitation.invited_name
                              }
                            </strong>

                            <span>
                              {
                                invitation.invited_email
                              }
                            </span>
                          </div>

                          <div>
                            <span
                              className={
                                `invitation-status ` +
                                `${invitation.status}`
                              }
                            >
                              {invitation.status}
                            </span>

                            <small>
                              {formatDate(
                                invitation.responded_at ??
                                  invitation.created_at,
                              )}
                            </small>
                          </div>
                        </article>
                      ),
                    )}
                  </div>
                )}
              </section>
            )}

            {isOwner && (
              <section className="household-panel">
                <div className="household-panel-heading">
                  <div>
                    <span className="eyebrow">
                      Invite
                    </span>

                    <h2>
                      Add a family member
                    </h2>
                  </div>

                  <Send size={22} />
                </div>

                <p>
                  The invited person must
                  already have a Chorevera
                  account.
                </p>

                <form
                  className="household-form"
                  onSubmit={
                    handleInviteMember
                  }
                >
                  <label>
                    Email address

                    <input
                      disabled={isSaving}
                      onChange={(event) =>
                        setInviteEmail(
                          event.target.value,
                        )
                      }
                      placeholder="family@example.com"
                      type="email"
                      value={inviteEmail}
                    />
                  </label>

                  <button
                    className="household-primary-button"
                    disabled={
                      isSaving ||
                      !inviteEmail.trim()
                    }
                    type="submit"
                  >
                    {isSaving ? (
                      <LoaderCircle
                        className="spinning-icon"
                        size={18}
                      />
                    ) : (
                      <Send size={18} />
                    )}

                    Send invitation
                  </button>
                </form>
              </section>
            )}
          </div>

          <aside className="household-sidebar">
            {isOwner && (
              <section className="household-panel">
                <div className="household-panel-heading">
                  <div>
                    <span className="eyebrow">
                      Pending
                    </span>

                    <h2>
                      Sent invitations
                    </h2>
                  </div>

                  <Mail size={21} />
                </div>

                {pendingSentInvitations.length ===
                0 ? (
                  <div className="household-empty-state">
                    <Mail size={28} />

                    <strong>
                      No pending invitations
                    </strong>

                    <span>
                      New invitations will
                      appear here.
                    </span>
                  </div>
                ) : (
                  <div className="sent-invitation-list">
                    {pendingSentInvitations.map(
                      (invitation) => (
                        <article
                          key={
                            invitation.id
                          }
                        >
                          <div>
                            <strong>
                              {
                                invitation.invited_name
                              }
                            </strong>

                            <span>
                              {
                                invitation.invited_email
                              }
                            </span>
                          </div>

                          <button
                            aria-label="Cancel invitation"
                            disabled={
                              pendingActionId ===
                              invitation.id
                            }
                            onClick={() => {
                              void handleCancelInvitation(
                                invitation.id,
                              );
                            }}
                            type="button"
                          >
                            {pendingActionId ===
                            invitation.id ? (
                              <LoaderCircle
                                className="spinning-icon"
                                size={16}
                              />
                            ) : (
                              <X size={16} />
                            )}
                          </button>
                        </article>
                      ),
                    )}
                  </div>
                )}
              </section>
            )}

            <section className="household-panel">
              <div className="household-panel-heading">
                <div>
                  <span className="eyebrow">
                    Workspace settings
                  </span>

                  <h2>
                    Display preferences
                  </h2>
                </div>

                <SlidersHorizontal size={21} />
              </div>

              <div className="household-preferences">
                <label>
                  Household accent

                  <select
                    onChange={(event) =>
                      setHouseholdAccent(
                        event.target.value,
                      )
                    }
                    value={householdAccent}
                  >
                    <option value="violet">
                      Violet
                    </option>

                    <option value="blue">
                      Blue
                    </option>

                    <option value="green">
                      Green
                    </option>

                    <option value="rose">
                      Rose
                    </option>
                  </select>
                </label>

                <label className="household-toggle-row">
                  <div>
                    <strong>
                      Compact member cards
                    </strong>

                    <span>
                      Reduce spacing in the member
                      directory.
                    </span>
                  </div>

                  <input
                    checked={compactMemberView}
                    onChange={(event) =>
                      setCompactMemberView(
                        event.target.checked,
                      )
                    }
                    type="checkbox"
                  />
                </label>
              </div>

              <p className="household-management-note">
                These display preferences are
                stored locally in this browser.
              </p>
            </section>

            <section className="household-panel danger-panel">
              <span className="eyebrow">
                Household settings
              </span>

              <h2>
                {isOwner
                  ? "Delete household"
                  : "Leave household"}
              </h2>

              <p>
                {isOwner
                  ? (
                      "Deleting the household removes all memberships."
                    )
                  : (
                      "Leaving removes you from this shared household."
                    )}
              </p>

              <button
                className="danger-button"
                disabled={isSaving}
                onClick={() => {
                  if (isOwner) {
                    void handleDeleteHousehold();
                  } else {
                    void handleLeaveHousehold();
                  }
                }}
                type="button"
              >
                {isOwner ? (
                  <Trash2 size={17} />
                ) : (
                  <LogOut size={17} />
                )}

                {isOwner
                  ? "Delete household"
                  : "Leave household"}
              </button>
            </section>
          </aside>
        </section>
      )}
    </main>
  );
}

