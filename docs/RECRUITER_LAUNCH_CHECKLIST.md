# Recruiter Launch Checklist

Before publishing the LinkedIn post:

- [ ] Run the branding installer and confirm the UI says **Chorevera**.
- [ ] Confirm `npm run build` passes.
- [ ] Confirm `python -m pytest -q` passes.
- [ ] Push the branding + README commit.
- [ ] Wait for both Render services to become Live.
- [ ] Open the live app in an incognito/private window.
- [ ] Confirm login, Dashboard, Household, AI Planner, Privacy, Terms, and Support load.
- [ ] Use a demo-safe screenshot with no personal email address, API key, payment details, or private household data.
- [ ] Pin the repository on your GitHub profile.
- [ ] Add the live project to LinkedIn's Featured section.
- [ ] Publish the LinkedIn post.
- [ ] Reply to comments with technical details rather than generic promotion.

Suggested screenshots:
1. Dashboard using a demo account.
2. Household Command Center.
3. AI Planner proposal/review screen.
4. A simple architecture diagram from the README.

Do not publicly share:
- `.env` files
- Stripe secret keys or webhook secrets
- OpenAI API keys
- Resend credentials
- PostgreSQL URLs
- database backup files
- screenshots containing private user information
