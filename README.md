# Revenue Recovery AI

Build a complete, polished RecoverAI – AI Revenue Recovery Platform frontend for a fintech hackathon.

Goal

RecoverAI detects lost/at-risk revenue from failed payments and checkout abandonment, analyzes the case, recommends a safe recovery action, executes it, verifies recovery, and records an audit trail.

Core flow:

Payment Failed → AI Analyze → Recovery Decision → Execute Action → Payment Recovered → Revenue Updated → Audit Logged

Tech

Use React + TypeScript + Vite + Tailwind CSS + shadcn/ui + Lucide icons + Recharts.

Create a professional enterprise fintech UI: clean white/dark text, blue/indigo accents, green success, orange warning, red errors, subtle borders/shadows, responsive design. Avoid excessive animations and flashy AI effects.

Pages

Create a sidebar navigation with:

Dashboard

Revenue at Risk

Recovery Cases

Transactions

Customers

Analytics

Audit Trail

Settings

Also include a top navbar with search, notifications, refresh, and user profile.

Dashboard

Show:

Revenue at Risk

Revenue Recovered

Recovery Rate

Active Cases

Customers Recovered

Escalated Cases

Add a Revenue Recovery Performance chart and Recent AI Recovery Activity.

Use realistic Indian demo data and INR amounts.

Revenue at Risk

Create a searchable/filterable table:

Customer | Transaction | Amount | Problem | Recovery Probability | Priority | AI Recommended Action | Status

Problems:

Payment Failed

Checkout Abandoned

Repeated Failure

Recovery Case Detail

This is the main demo page.

Show:

Customer

Transaction

Amount at Risk

Failure Reason

Recovery Probability

Priority

AI Decision

AI Reasoning

Recommended Action

Recovery Attempts

Recovery Guardrails

Recovery Timeline

Audit History

Buttons:

Analyze Case
Execute Recovery
Generate Payment Link
Escalate
Stop Recovery

AI reasoning must be simple and business-readable.

Recovery Guardrails

Display:

Maximum attempts: 3

Maximum contacts: 2

Recovery window: 24 hours

High-value threshold: ₹50,000

Human approval above threshold

Automatically disable recovery when the limit is reached.

Demo Scenarios

Make the UI interactive:

Scenario 1:
₹18,500 failed payment → AI analyzes → 82% recovery probability → Generate Payment Link → Recovery Initiated → Mark as Recovered → dashboard revenue increases.

Scenario 2:
₹75,000 repeated failure → AI recommends Human Review → automatic recovery blocked → Escalate.

Scenario 3:
Case reaches 3/3 attempts → Recovery automatically stopped.

Use toast notifications and confirmation dialogs for actions.

Transactions

Table showing:

Transaction ID | Customer | Amount | Payment Method | Date | Status | Failure Reason | Recovery Status

Customers

Show customer payment history, failed payments, recovery cases, and recovered revenue.

Analytics

Show charts for:

Revenue at Risk vs Recovered

Recovery Rate

Recovery by Failure Reason

Recovery by Payment Method

Audit Trail

Show every system/AI/human action:

Timestamp | Case ID | Event | Decision | Action | Result

Example:
Payment Failed → AI Analyzed → Recovery Link Generated → Payment Recovered.

Settings

Include simple recovery configuration:

Max attempts

Recovery window

High-value threshold

AI confidence threshold

Notifications

Login

Create a simple professional RecoverAI login page with:

Continue with Demo Account

No complex authentication required.

Data & Architecture

Use realistic mock data through a centralized service/data layer, NOT hardcoded separately inside components.

Make the frontend backend-ready for future FastAPI/Supabase integration with:

GET /api/dashboard
GET /api/transactions
GET /api/recovery-cases
POST /api/recovery-cases/:id/analyze
POST /api/recovery-cases/:id/execute
POST /api/recovery-cases/:id/escalate
POST /api/recovery-cases/:id/stop
POST /api/recovery-cases/:id/payment-link
GET /api/audit

Final Requirement

Make all navigation, filters, buttons, modals, status changes, charts, and demo recovery flows functional.

The product must clearly communicate:

“Don’t just detect lost revenue. Recover it.”

Prioritize the complete working journey:

Detect → Understand → Decide → Recover → Verify → Audit

Make it look like a real fintech AI product, not a generic student dashboard.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://revive-zen.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/c270ecb0-0c15-4220-b8a8-b1079e0bd6f1).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
