# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: microsite/microsite-generation.spec.ts >> Microsite Negative - Incomplete Buyer ID @regression
- Location: tests/microsite/microsite-generation.spec.ts:519:7

# Error details

```
Error: expect(received).toContain(expected) // indexOf

Expected substring: "add buyer ids first"
Received string:    "sent clarification request - projects not found"
```

# Test source

```ts
  453 |   {
  454 |     name:
  455 |       'Special Characters Only',
  456 |     body:
  457 |       '@@@ ### $$$'
  458 |   },
  459 | 
  460 |   {
  461 |     name:
  462 |       'Incomplete Buyer ID',
  463 |     body:
  464 |       'Harsha with ID for Abhee'
  465 |   },
  466 | 
  467 |   {
  468 |     name:
  469 |       'Invalid Buyer ID',
  470 |     body:
  471 |       'Harsha with ID @@@ for Abhee'
  472 |   }
  473 | 
  474 | ];
  475 | 
  476 | // ======================================================
  477 | // POSITIVE TEST EXECUTION
  478 | // ======================================================
  479 | 
  480 | for (
  481 |   const testData
  482 |   of positiveCases
  483 | ) {
  484 | 
  485 |   test(
  486 |     `Microsite Positive - ${testData.name} @sanity`,
  487 | 
  488 |     async ({ request }) => {
  489 | 
  490 |       const {
  491 |         responseBody
  492 |       } =
  493 |         await sendMicrositeRequest(
  494 |           request,
  495 |           testData.body
  496 |         );
  497 | 
  498 |       assertSuccess(responseBody);
  499 | 
  500 |       assertExpectedFields(
  501 |         responseBody,
  502 |         testData.expectedFields
  503 |       );
  504 | 
  505 |     }
  506 |   );
  507 | 
  508 | }
  509 | 
  510 | // ======================================================
  511 | // NEGATIVE TEST EXECUTION
  512 | // ======================================================
  513 | 
  514 | for (
  515 |   const testData
  516 |   of negativeCases
  517 | ) {
  518 | 
  519 |   test(
  520 |     `Microsite Negative - ${testData.name} @regression`,
  521 | 
  522 |     async ({ request }) => {
  523 | 
  524 |       const {
  525 |         responseBody
  526 |       } =
  527 |         await sendMicrositeRequest(
  528 |           request,
  529 |           testData.body
  530 |         );
  531 | 
  532 |       if (testData.name === 'Invalid Project Name') {
  533 |   expect(responseBody.success).toBe(true);
  534 |   expect(responseBody.micrositeUrl).toBeFalsy();
  535 |   expect(responseBody.message.toLowerCase())
  536 |     .toContain('projects not found');
  537 | 
  538 | } else if (testData.name === 'Numeric Buyer Name') {
  539 |   expect(responseBody.success).toBe(true);
  540 |   expect(responseBody.micrositeUrl).toBeFalsy();
  541 |   expect(responseBody.message.toLowerCase())
  542 |     .toContain('invalid username format');
  543 | } else if (testData.name === 'Special Characters Only') {
  544 |   expect(responseBody.success).toBe(true);
  545 |   expect(responseBody.micrositeUrl).toBeFalsy();
  546 |   expect(responseBody.message.toLowerCase())
  547 |     .toContain('clarification');
  548 | }
  549 | else if (testData.name === 'Incomplete Buyer ID') {
  550 |   expect(responseBody.success).toBe(true);
  551 |   expect(responseBody.micrositeUrl).toBeFalsy();
  552 |   expect(responseBody.message.toLowerCase())
> 553 |     .toContain('add buyer ids first');
      |      ^ Error: expect(received).toContain(expected) // indexOf
  554 | }
  555 | else if (testData.name === 'Invalid Buyer ID') {
  556 |   expect(responseBody.success).toBe(true);
  557 |   expect(responseBody.micrositeUrl).toBeFalsy();
  558 |   expect(responseBody.message.toLowerCase())
  559 |     .toContain('add buyer ids first');
  560 | }
  561 | 
  562 | else {
  563 |   assertFailure(responseBody);
  564 | }
  565 | 
  566 |     }
  567 |   );
  568 | 
  569 | }
  570 | 
  571 | // ======================================================
  572 | // MICROSITE REUSE FLOW
  573 | // ======================================================
  574 | 
  575 | test(
  576 |   'Microsite Reuse Flow @regression',
  577 | 
  578 |   async ({ request }) => {
  579 | 
  580 |     const buyerId =
  581 |       TEST_BUYER_ID;
  582 | 
  583 |     const BODY =
  584 |       `Harsha with ID ${buyerId} for Abhee`;
  585 | 
  586 |     const first =
  587 |       await sendMicrositeRequest(
  588 |         request,
  589 |         BODY
  590 |       );
  591 | 
  592 |     const second =
  593 |       await sendMicrositeRequest(
  594 |         request,
  595 |         BODY
  596 |       );
  597 | 
  598 |     assertSuccess(
  599 |       first.responseBody
  600 |     );
  601 | 
  602 |     assertSuccess(
  603 |       second.responseBody
  604 |     );
  605 | 
  606 |     expect(
  607 |       first.responseBody
  608 |         .micrositeUrl
  609 |     ).toBe(
  610 |       second.responseBody
  611 |         .micrositeUrl
  612 |     );
  613 | 
  614 |   }
  615 | );
  616 | 
  617 | // ======================================================
  618 | // PERFORMANCE TEST
  619 | // ======================================================
  620 | 
  621 | test(
  622 |   'Microsite API Performance @performance',
  623 | 
  624 |   async ({ request }) => {
  625 | 
  626 |     const buyerId =
  627 |       TEST_BUYER_ID;
  628 | 
  629 |     const start =
  630 |       Date.now();
  631 | 
  632 |     const {
  633 |       responseBody
  634 |     } =
  635 |       await sendMicrositeRequest(
  636 |         request,
  637 |         `Harsha with ID ${buyerId} for Abhee`
  638 |       );
  639 | 
  640 |     const ms =
  641 |       Date.now() - start;
  642 | 
  643 |     console.log(
  644 |       `Response time: ${ms} ms`
  645 |     );
  646 | 
  647 |     assertSuccess(
  648 |       responseBody
  649 |     );
  650 | 
  651 |     expect(ms)
  652 |       .toBeLessThan(5000);
  653 | 
```