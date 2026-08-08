# PropFocus E2E Framework

Production-grade Playwright + TypeScript E2E automation framework for validating PropFocus dashboard, microsite, alerts, WhatsApp journeys, and API workflows.

## Architecture

- `tests/`: Business-domain test suites (`dashboard`, `microsite`, `alerts`, `whatsapp`, `smoke`)
- `pageObjects/`: Stable Page Object Model abstraction for UI interactions
- `fixtures/`: Shared Playwright fixtures for dependency injection of page objects
- `utils/`: Reusable helpers, API client wrappers, and typed test-data factories
- `playwright.config.ts`: Unified enterprise runner settings (retry, trace, reporter, CI-friendly defaults)

### Why this scales

- POM keeps selectors and page behavior centralized.
- Fixture layer keeps tests clean and readable.
- Utilities reduce duplication across workflows.
- Domain-based folder split avoids test sprawl as suites grow.

## Prerequisites

- Node.js 20+ recommended
- npm 9+

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Install Playwright browsers:

   ```bash
   npx playwright install
   ```

3. Create environment file:

   ```bash
   cp .env.example .env
   ```

4. Update `.env` values for your PropFocus environment.

## Available Scripts

- `npm test` - run full test suite
- `npm run test:headed` - run with headed browser
- `npm run test:ui` - open Playwright UI runner
- `npm run smoke` - run smoke-tagged tests only
- `npm run test:report` - open HTML report

## Implemented End-to-End Test

`tests/microsite/microsite-generation.spec.ts`

Scenario: **Microsite should generate successfully from dashboard**

Flow covered:

1. Open login page
2. Login using env credentials
3. Navigate to microsite page
4. Fill buyer name + phone number
5. Click Generate Microsite
6. Validate success toast, generated link visibility, and URL format
7. Capture generated URL
8. Open generated URL in new tab
9. Validate buyer name on live microsite

## Coverage (expanded suite)

The suite now covers all four buyer-link types and the dashboard/admin surfaces.
New areas and their spec files:

| Area | Spec file(s) | How it verifies |
|------|--------------|-----------------|
| Post-visit creation (standalone + phased, tags, accessibility, reuse, negatives) | `tests/post-visit/post-visit-creation.spec.ts` | WhatsApp webhook → `linkToken`/`postVisitUrl` |
| EOI creation (campaign project, reuse, no-campaign/negatives) | `tests/eoi/eoi-creation.spec.ts` | WhatsApp webhook → `linkToken`/`eoiUrl` |
| Tracking on all 4 pages | `tests/tracking/buyer-link-tracking.spec.ts` | `POST /track-event` + `/site-visit|post-visit|eoi/:token/activity`, read back via `/microsite/:id/events` and page GETs |
| Themes (project-theme overrides + EOI hola) + theme-agnostic tracking | `tests/themes/theme-coverage.spec.ts` | Page render + `?projectTheme=` override + tracking still fires |
| Buyer links across tier 1/2/3 domains | `tests/domain-testing/tier-buyer-links.spec.ts` | Asserts `postVisitUrl`/`eoiUrl` match each tier's URL shape |
| Broker alerts | `tests/alerts/broker-alerts.spec.ts` | Admin `engagement-alert-audit` / `visitor-alert-audit` (alerts are WhatsApp-only, verified via backend audit) |
| Dashboard real-time (60s polling) | `tests/dashboard/realtime-updates.spec.ts` | Create activity → poll `recent-activity` / `microsites` |
| Dashboard permissions & personas | `tests/dashboard/persona-permissions.spec.ts` | `broker-profile` role assertions + org-wide vs self scoping |
| Admin panel | `tests/admin/admin-panel.spec.ts` | Admin login + read-only list endpoints + auth gating |

Shared helpers live in `utils/buyerLinks.ts`, `utils/tracking.ts`, `utils/dashboardApi.ts`,
`utils/adminApi.ts`, and `utils/personas.ts`.

### Required `.env` for full coverage

Copy `.env.example` → `.env` and fill in real **dev** accounts. Values with a baked-in
default run without config; the rest gate specific areas:

- `TEST_PHONE` — a broker whose org can access the test projects (otherwise creation
  tests get "permission denied"). Set `POST_VISIT_PROJECT` / `EOI_PROJECT` /
  `PHASED_PROJECT` to projects that broker can actually access.
- `OWNER_PHONE`, `GM_PHONE`, `PRESALES_MANAGER_PHONE`, `PRESALES_REP_PHONE`,
  `SALES_REP_PHONE`, `MARKETING_REP_PHONE` — persona/permission tests **skip** when unset.
- `ADMIN_EMAIL`, `ADMIN_PASSWORD` — admin-panel and alert-audit tests **skip** when unset.

Tests are tagged `@sanity` (happy path) and `@regression` (negatives/edge). Timing-gated
checks (broker alert delivery) are best-effort and log rather than hard-fail on async delay.

## Selector Strategy

Use `data-testid` selectors only.  
Current selectors expected by the framework:

- `login-email`
- `login-password`
- `login-submit`
- `dashboard-home`
- `nav-microsite`
- `microsite-form`
- `microsite-buyer-name`
- `microsite-phone-number`
- `microsite-generate-button`
- `toast-success`
- `microsite-generated-url`
- `buyer-name`

## Notes for Enterprise Teams

- Keep each page object's public methods business-focused.
- Add API assertions via `utils/api.ts` for workflow-level contract checks.
- Keep test data generation deterministic where needed for repeatability.
