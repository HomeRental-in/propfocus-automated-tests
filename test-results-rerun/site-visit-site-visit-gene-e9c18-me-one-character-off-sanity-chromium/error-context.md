# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: site-visit/site-visit-generation.spec.ts >> SiteVisit Positive - TC_LINK_04 (Minor typo) - Project name one character off @sanity
- Location: tests/site-visit/site-visit-generation.spec.ts:578:7

# Error details

```
Error: expect(received).toContain(expected) // indexOf

Expected substring: "abhee tranquila"
Received string:    "sent clarification request - invalid format"
```

# Test source

```ts
  78  |           body: messageBody
  79  |         }
  80  |       }
  81  |     }
  82  |   );
  83  | 
  84  |   expect(response.status()).toBe(200);
  85  | 
  86  |   const responseBody:
  87  |     SiteVisitResponseBody =
  88  |       await response.json();
  89  | 
  90  |   console.log(
  91  |     `\nPhone      : ${phone}`
  92  |   );
  93  | 
  94  |   console.log(
  95  |     `Request    : ${messageBody}`
  96  |   );
  97  | 
  98  |   console.log(
  99  |     JSON.stringify(
  100 |       responseBody,
  101 |       null,
  102 |       2
  103 |     )
  104 |   );
  105 | 
  106 |   return {
  107 |     response,
  108 |     responseBody
  109 |   };
  110 | }
  111 | 
  112 | // ======================================================
  113 | // ASSERTIONS
  114 | // ======================================================
  115 | 
  116 | function assertSuccess(                                            // assertion function to validate that the site visit booking was successful
  117 |   body: SiteVisitResponseBody
  118 | ) {
  119 | 
  120 |   expect(body.success)
  121 |     .toBe(true);
  122 | 
  123 |   expect(body.message)
  124 |     .toBeTruthy();
  125 | 
  126 | }
  127 | 
  128 | function assertFailure(                                            // assertion function to validate that the site visit booking was correctly rejected
  129 |   body: SiteVisitResponseBody
  130 | ) {
  131 | 
  132 |   expect(body.success)
  133 |     .not.toBe(true);
  134 | 
  135 | }
  136 | 
  137 | function assertExpectedFields(                                     
  138 |   body: SiteVisitResponseBody,
  139 |   fields?: SiteVisitCase['expectedFields']
  140 | ) {
  141 | 
  142 |   // Skip validation if no expected fields exist
  143 |   if (!fields) return;
  144 | 
  145 |   // Convert response message to lowercase
  146 |   const message =
  147 |     body.message.toLowerCase();
  148 | 
  149 |   // Only validate fields if backend response
  150 |   // actually contains detailed values
  151 |   // like buyer name/project name.
  152 |   //
  153 |   // Site-visit API currently returns:
  154 |   // "Site visit link created"
  155 |   //
  156 |   // So skip validation for generic responses.
  157 |   if (
  158 |     message.includes(
  159 |       'site visit link created'
  160 |     )
  161 |   ) {
  162 | 
  163 |     return;
  164 | 
  165 |   }
  166 | 
  167 |   // Loop through all expected values
  168 |   for (
  169 |     const value of
  170 |     Object.values(fields)
  171 |   ) {
  172 | 
  173 |     // Ignore undefined/empty values
  174 |     if (value) {
  175 | 
  176 |       // Validate value exists in response
  177 |       expect(message)
> 178 |         .toContain(
      |          ^ Error: expect(received).toContain(expected) // indexOf
  179 |           value.toLowerCase()
  180 |         );
  181 | 
  182 |     }
  183 | 
  184 |   }
  185 | 
  186 | }
  187 | 
  188 | // ======================================================
  189 | // POSITIVE TEST CASES
  190 | // ======================================================
  191 | 
  192 | const positiveCases:
  193 |   SiteVisitCase[] = [
  194 | 
  195 |   {
  196 |     name: 'TC_SV_14 - Valid input with buyer ID, project, date and time',
  197 |     body:
  198 |       'Harsha B123 for sv Abhee Tranquila on tomorrow 11 AM',
  199 |     expectedFields: {
  200 |       buyerName:   'Harsha',
  201 |       projectName: 'Abhee Tranquila',
  202 |       visitTime:   '11'
  203 |     }
  204 |   },
  205 | 
  206 |   {
  207 |     name: 'TC_SV_16 - No time given — default time should be 10 AM',
  208 |     body:
  209 |       'Harsha B123 for sv Abhee Tranquila on tomorrow',
  210 |     expectedFields: {
  211 |       buyerName:   'Harsha',
  212 |       projectName: 'Abhee Tranquila',
  213 |       visitTime:   '10'
  214 |     }
  215 |   },
  216 | 
  217 |   {
  218 |     name: 'TC_SV(Natural language + ID) - Full natural language booking request',
  219 |     body:
  220 |       'Please book site visit for Harsha B123 at Abhee Tranquila on tomorrow 11 AM',
  221 |     expectedFields: {
  222 |       buyerName:   'Harsha',
  223 |       projectName: 'Abhee Tranquila'
  224 |     }
  225 |   },
  226 | 
  227 |   {
  228 |     name: 'TC_SV(Date variation) - Relative date "coming Sunday"',
  229 |     body:
  230 |       'Harsha B123 for sv Abhee Tranquila on coming Sunday',
  231 |     expectedFields: {
  232 |       buyerName:   'Harsha',
  233 |       projectName: 'Abhee Tranquila'
  234 |     }
  235 |   },
  236 | 
  237 |   {
  238 |     name: 'TC_SV(Extra spaces input) - Extra spaces between words',
  239 |     body:
  240 |       ' Harsha B123 for sv Abhee Tranquila on tomorrow',
  241 |     expectedFields: {
  242 |       buyerName:   'Harsha',
  243 |       projectName: 'Abhee Tranquila'
  244 |     }
  245 |   },
  246 | 
  247 |   {
  248 |     name: 'TC_SV(Case insensitive input) - Mixed case input',
  249 |     body:
  250 |       'hArShA b123 FoR sV aBhEe TrAnQuIlA ToMoRrO',
  251 |     expectedFields: {
  252 |       buyerName:   'Harsha',
  253 |       projectName: 'Abhee Tranquila'
  254 |     }
  255 |   },
  256 | 
  257 |   {
  258 |     name: 'TC_SV(With buyer name + ID) - Conversational input',
  259 |     body:
  260 |       'Can you schedule a site visit for Harsha B123 in Abhee Tranquila tomorrow',
  261 |     expectedFields: {
  262 |       buyerName:   'Harsha',
  263 |       projectName: 'Abhee Tranquila'
  264 |     }
  265 |   },
  266 | 
  267 |   {
  268 |     name: 'TC_LINK_04 (Minor typo) - Project name one character off',
  269 |     body:
  270 |       'Harsha B123 for sv Abhee Tranqula',
  271 |     expectedFields: {
  272 |       projectName: 'Abhee Tranquila'
  273 |     }
  274 |   },
  275 | 
  276 |   {
  277 |     name: 'TC_SV_21 - Ambiguous date "this 18th"',
  278 |     body:
```