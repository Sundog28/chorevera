# Optional Show HN Draft

## Title

Show HN: Chorevera – a household-management SaaS with guarded AI planning

## Post

I built Chorevera as a production-oriented full-stack/AI engineering project.

It is a household-management app with multi-user households, chore assignment, progress tracking, notifications, subscriptions, and an AI planning workflow.

The AI part is the piece I wanted to make more than a chat wrapper. The backend builds a limited context from the household's current relational data, asks the model for typed/structured actions, validates all referenced members and chores deterministically, displays the plan for review, and requires an authenticated household owner to approve it before any database write.

If the provider fails or the output is invalid, the app falls back to deterministic workload balancing.

Stack: React/TypeScript, FastAPI/Python, PostgreSQL/SQLModel, OpenAI API, Stripe, Render.

Live: https://choreflow-web.onrender.com
Source: https://github.com/Sundog28/choreflow

I'd especially appreciate feedback on the AI validation/approval architecture and the product UX.
