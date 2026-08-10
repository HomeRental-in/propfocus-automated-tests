import { test, expect, APIRequestContext } from '@playwright/test';
import { aiSearchQuestions } from './aiSearchQuestions';
import fs from 'fs';
import path from 'path';

// ---------------- CONFIG ----------------
const BASE_URL = 'https://dev.propfocus.in';
const AI_SEARCH_ENDPOINT = '/api/dashboard/ai-search';
const RESULTS_FILE = 'ai-search-results.json';
const PARTIAL_DIR = 'ai-search-results-partial';

// Use the token your sir shared
const DEV_AUTH_TOKEN =
  process.env.AI_SEARCH_TOKEN || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJicm9rZXJJZCI6IjkxNjE3Y2E5LTI3ZmEtNDM1NC04NzEyLWVjZmY2ODIzNGExYSIsImJyb2tlck5hbWUiOiJBcmhhbiIsImJyb2tlclR5cGUiOiJzdWIiLCJwaG9uZSI6Iis5MTgzNzQwOTU1MDYiLCJvcmdhbml6YXRpb25faWQiOiJmZGYyYjg2ZS0zY2RhLTRmMjctOWNlMi1iOTliYjY2ZmUwOWYiLCJvcmdSb2xlTGV2ZWwiOiJyZXByZXNlbnRhdGl2ZSIsInRlYW1GdW5jdGlvbiI6InByZXNhbGVzIiwibWFuYWdlckZ1bmN0aW9ucyI6W10sImlhdCI6MTc4MzQ1MTQ1MiwiZXhwIjoxNzg0MDU2MjUyfQ.XnitNAc6UgWJrdOWUfKptJ3Wb6aM9oViBf-6UiguUeE';

let apiContext: APIRequestContext;

function mergeResultsFile() {
  if (!fs.existsSync(PARTIAL_DIR)) return;

  const partialFiles = fs
    .readdirSync(PARTIAL_DIR)
    .filter((name) => name.endsWith('.json'))
    .sort((a, b) => Number(a.replace('.json', '')) - Number(b.replace('.json', '')));

  const results = partialFiles.map((name) =>
    JSON.parse(fs.readFileSync(path.join(PARTIAL_DIR, name), 'utf8'))
  );

  fs.writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2));
  console.log(`\nResponses saved to ${RESULTS_FILE} (${results.length}/${aiSearchQuestions.length} entries)`);

  // Only clean up once every question has a partial file.
  if (results.length === aiSearchQuestions.length) {
    fs.rmSync(PARTIAL_DIR, { recursive: true, force: true });
  }
}

test.describe('AI Search API Question Sweep', () => {
  // One worker avoids in-memory races; per-question files still protect against overwrites.
  test.describe.configure({ mode: 'default' });

  test.beforeAll(async ({ playwright }) => {
    fs.mkdirSync(PARTIAL_DIR, { recursive: true });

    apiContext = await playwright.request.newContext({
      baseURL: BASE_URL,
      extraHTTPHeaders: {
        Authorization: `Bearer ${DEV_AUTH_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });
  });

  test.afterAll(async () => {
    mergeResultsFile();
    await apiContext?.dispose();
  });

  for (const [index, question] of aiSearchQuestions.entries()) {
    test(`Q${index + 1}: ${question || '(empty)'}`, async () => {
      const response = await apiContext.post(AI_SEARCH_ENDPOINT, {
        data: {
          query: question,
          conversation_id: `test-conv-${index + 1}`,
          explain_mode: false,
        },
      });

      const status = response.status();
      let body: unknown;
      try {
        body = await response.json();
      } catch {
        body = { error: 'Non-JSON response', text: await response.text() };
      }

      // Persist before asserting so failures still land in the results file.
      fs.writeFileSync(
        path.join(PARTIAL_DIR, `${String(index + 1).padStart(3, '0')}.json`),
        JSON.stringify({ question, status, response: body }, null, 2)
      );

      const expectedStatus =
        question.trim() === '' || question.includes('<script>') ? 400 : 200;

      expect(status).toBe(expectedStatus);

      console.log('--------------------------------------');
      console.log(`Question ${index + 1}`);
      console.log(question);
      console.log('--------------------------------------');
      console.log(JSON.stringify(body, null, 2));
      console.log('--------------------------------------\n');
    });
  }
});
