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
