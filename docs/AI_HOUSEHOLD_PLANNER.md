# AI Household Planner

## Purpose

The AI Household Planner turns a natural-language household goal into a structured, reviewable set of chore actions.

Example request:

> We have guests coming Saturday. Get the kitchen, bathrooms, laundry, and living room done beforehand and divide the work fairly.

The feature is designed as an AI-assisted decision system rather than a chat box. It combines model output with deterministic application rules before any database mutation is allowed.

## Architecture

1. The authenticated React page sends `household_id`, `request_text`, and `max_actions` to `POST /api/v1/ai/household-plan`.
2. FastAPI checks the user's AI entitlement and household membership.
3. The server builds limited context from PostgreSQL:
   - household member IDs and display names
   - current incomplete household chores and assignments
   - current incomplete workload per member
   - recent completed/reopened counts
4. The backend sends that context and the user's request to the OpenAI Responses API and parses the result into a Pydantic schema.
5. A deterministic semantic validator rejects plans that reference unknown household members, stale/unknown chores, duplicate reassignments, or duplicate current chores.
6. The UI displays the plan for review. No database change happens during generation.
7. Only the household owner can call `POST /api/v1/ai/household-plan/apply`.
8. The apply endpoint rebuilds current household context and revalidates every action before writing.
9. Approved actions reuse existing activity-feed and notification infrastructure.

## Safety boundaries

- The model cannot delete chores through this feature.
- It cannot modify completed chores.
- It cannot assign to a user ID outside the household.
- It cannot reassign a chore ID outside the household's current incomplete workload.
- Existing chore title/reminder data is canonicalized server-side for reassign actions.
- A create action that duplicates a current incomplete chore title is rejected.
- Database changes require an authenticated household owner's explicit approval.
- The server rate-limits generate/apply endpoints.
- OpenAI provider failures or invalid model output trigger a deterministic fallback that only rebalances existing incomplete chores.

## Data minimization

The AI request context intentionally omits household member email addresses, password hashes, payment data, API credentials, and authentication tokens. It includes the user's planning request, member display names/IDs, chore titles/assignments/reminder times, and limited workload/completion statistics needed for planning.

## Evaluation

`apps/api/scripts/evaluate_ai_planner.py` runs representative synthetic household scenarios through the same model call and semantic validator used by production. It reports:

- scenario validity rate
- number of proposed actions
- projected workload gap
- provider/model behavior

Backend regression tests separately verify invalid member IDs, invalid chore IDs, canonical reassignments, duplicate current chore protection, and fallback action boundaries.

## Portfolio talking points

- Built a production AI feature around real relational application context rather than a standalone prompt demo.
- Used schema-constrained model output plus deterministic semantic validation.
- Separated proposal from mutation with an explicit human approval boundary.
- Designed graceful fallback behavior for model/API failures.
- Added rate limiting, entitlements, privacy disclosure, regression tests, and an evaluation harness.
- Reused the application's existing authorization, notification, audit/activity, subscription, and PostgreSQL layers.
