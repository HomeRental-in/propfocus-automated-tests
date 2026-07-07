import { test, expect, APIRequestContext } from '@playwright/test';
import { aiSearchQuestions } from './aiSearchQuestions';
import fs from 'fs';

// ---------------- CONFIG ----------------
const BASE_URL = 'https://dev.propfocus.in';
const AI_SEARCH_ENDPOINT = '/api/dashboard/ai-search';

// Use the token your sir shared
const DEV_AUTH_TOKEN =
  process.env.AI_SEARCH_TOKEN || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJicm9rZXJJZCI6IjkxNjE3Y2E5LTI3ZmEtNDM1NC04NzEyLWVjZmY2ODIzNGExYSIsImJyb2tlck5hbWUiOiJBcmhhbiIsImJyb2tlclR5cGUiOiJzdWIiLCJwaG9uZSI6Iis5MTgzNzQwOTU1MDYiLCJvcmdhbml6YXRpb25faWQiOiJmZGYyYjg2ZS0zY2RhLTRmMjctOWNlMi1iOTliYjY2ZmUwOWYiLCJvcmdSb2xlTGV2ZWwiOiJyZXByZXNlbnRhdGl2ZSIsInRlYW1GdW5jdGlvbiI6InByZXNhbGVzIiwibWFuYWdlckZ1bmN0aW9ucyI6W10sImlhdCI6MTc4MzQ1MTQ1MiwiZXhwIjoxNzg0MDU2MjUyfQ.XnitNAc6UgWJrdOWUfKptJ3Wb6aM9oViBf-6UiguUeE'
let apiContext: APIRequestContext;
const results: any[] = [];

test.describe('AI Search API Question Sweep', () => {

  test.beforeAll(async ({ playwright }) => {

    apiContext = await playwright.request.newContext({
      baseURL: BASE_URL,
      extraHTTPHeaders: {
        Authorization: `Bearer ${DEV_AUTH_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });

  });

  test.afterAll(async () => {

    fs.writeFileSync(
      'ai-search-results.json',
      JSON.stringify(results, null, 2)
    );

    await apiContext.dispose();

    console.log('\nResponses saved to ai-search-results.json');
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

      const expectedStatus =
  question.trim() === "" || question.includes("<script>")
    ? 400
    : 200;

expect(response.status()).toBe(expectedStatus);

      const body = await response.json();

      results.push({
        question,
        response: body,
      });

      console.log('--------------------------------------');
      console.log(`Question ${index + 1}`);
      console.log(question);
      console.log('--------------------------------------');
      console.log(JSON.stringify(body, null, 2));
      console.log('--------------------------------------\n');

    });

  }

});