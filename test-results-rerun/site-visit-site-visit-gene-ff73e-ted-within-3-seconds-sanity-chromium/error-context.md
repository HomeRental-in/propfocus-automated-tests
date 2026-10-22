# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: site-visit/site-visit-generation.spec.ts >> SiteVisit Positive - TC_SV_46 - Response generated within 3 seconds @sanity
- Location: tests/site-visit/site-visit-generation.spec.ts:721:5

# Error details

```
Error: expect(received).toBeLessThan(expected)

Expected: < 3000
Received:   3167
```

# Test source

```ts
  649 | 
  650 |     async ({ request }) => {
  651 | 
  652 |       test.fail();                        // tells Playwright this test is expected to currently fail — remove this line once the bug is fixed
  653 | 
  654 |       const {
  655 |         responseBody
  656 |       } =
  657 |         await sendSiteVisitRequest(
  658 |           request,
  659 |           testData.body,
  660 |           testData.phone ?? PHONE.ACTIVE
  661 |         );
  662 | 
  663 |       assertSuccess(
  664 |         responseBody
  665 |       );
  666 | 
  667 |     }
  668 |   );
  669 | 
  670 | }
  671 | 
  672 | // ======================================================
  673 | // TC_LINK_01 - MICROSITE LINK REUSE
  674 | // Same input twice must return the same micrositeUrl
  675 | // ======================================================
  676 | 
  677 | test(
  678 |   'SiteVisit Positive - TC_LINK_01 - Same buyer and project returns same microsite link @sanity',
  679 | 
  680 |   async ({ request }) => {
  681 | 
  682 |     const BODY =
  683 |       'Harsha B123 site visit for Abhee Tranquila';
  684 | 
  685 |     const first =
  686 |       await sendSiteVisitRequest(
  687 |         request,
  688 |         BODY
  689 |       );
  690 | 
  691 |     const second =
  692 |       await sendSiteVisitRequest(
  693 |         request,
  694 |         BODY
  695 |       );
  696 | 
  697 |     assertSuccess(
  698 |       first.responseBody
  699 |     );
  700 | 
  701 |     assertSuccess(
  702 |       second.responseBody
  703 |     );
  704 | 
  705 |     expect(
  706 |   first.responseBody
  707 |     .link_token
  708 | ).toBe(
  709 |   second.responseBody
  710 |     .link_token
  711 | );
  712 |   }
  713 | );
  714 | 
  715 | 
  716 | // ======================================================
  717 | // TC_SV_46 - PERFORMANCE TEST
  718 | // Response must be generated within 3 seconds
  719 | // ======================================================
  720 | 
  721 | test(
  722 |   'SiteVisit Positive - TC_SV_46 - Response generated within 3 seconds @sanity',
  723 | 
  724 |   async ({ request }) => {
  725 | 
  726 |     const start =
  727 |       Date.now();
  728 | 
  729 |     const {
  730 |       responseBody
  731 |     } =
  732 |       await sendSiteVisitRequest(
  733 |         request,
  734 |         'Harsha B123 for sv Abhee Tranquila on tomorrow 11 AM'
  735 |       );
  736 | 
  737 |     const ms =
  738 |       Date.now() - start;
  739 | 
  740 |     console.log(
  741 |       `Response time: ${ms} ms`
  742 |     );
  743 | 
  744 |     assertSuccess(
  745 |       responseBody
  746 |     );
  747 | 
  748 |     expect(ms)
> 749 |       .toBeLessThan(3000);
      |        ^ Error: expect(received).toBeLessThan(expected)
  750 | 
  751 |   }
  752 | 
  753 | );
```