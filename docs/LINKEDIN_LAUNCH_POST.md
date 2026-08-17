# LinkedIn Launch Post

I built and deployed a production full-stack SaaS application with an AI-assisted planning workflow.

**Chorevera** is a household-management platform I built with React, TypeScript, Python, FastAPI, PostgreSQL, SQLModel, Stripe, OpenAI, and Render.

Instead of stopping at basic CRUD, I pushed the project through the kinds of problems that show up when software actually reaches production:

• Multi-user households, invitations, permissions, and shared chores  
• Progress tracking, notifications, analytics, achievements, and workload balancing  
• JWT authentication, email verification, and password recovery  
• PostgreSQL migrations and a SQLite → PostgreSQL production-data migration  
• Stripe Checkout, Billing Portal, live subscriptions, and signed webhooks  
• Transactional email and production environment configuration  
• Rate limiting, security headers, audit logging, backups, and regression tests  
• An AI Household Planner that uses real household context, returns structured plans, validates model output server-side, and requires human approval before changing data

One of the most useful parts of this project was learning how different production systems interact. I had to debug migrations, dependency issues, Stripe test/live separation, webhook behavior, frontend production builds, CORS, routing, and deployment configuration—not just write feature code.

For the AI Planner, I deliberately avoided building a simple chat wrapper. The model receives limited relational context, produces schema-constrained output, passes deterministic validation, and cannot directly mutate household data without owner approval.

**Tech:** React · TypeScript · Vite · Python · FastAPI · PostgreSQL · SQLModel · Pydantic · OpenAI API · Stripe · Render · Git/GitHub

Live demo:
https://choreflow-web.onrender.com

Source:
https://github.com/Sundog28/choreflow

I’m looking for opportunities in **AI application engineering, backend engineering, and full-stack software engineering** where I can keep building and shipping production systems.

#SoftwareEngineering #FullStack #Python #FastAPI #React #TypeScript #PostgreSQL #AIEngineering #OpenAI #SaaS
