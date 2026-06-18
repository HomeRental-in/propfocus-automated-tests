/**
 * Site visit generation test configuration.
 *
 * Reuses the project catalog from micrositeProjects.ts — site visit booking
 * requires a microsite to exist for the same buyer + project first.
 *
 * Fill project entries in utils/micrositeProjects.ts.
 */

export {
  MICROSITE_TEST_PROJECTS as SITE_VISIT_TEST_PROJECTS,
  PROJECT_SPELLING_VARIANTS,
  PROJECT_UNRESOLVABLE_SPELLINGS,
  BOSS_TEST_PROJECTS,
  INACTIVE_TEST_PROJECTS,
  PHASED_ALIAS_TEST_CASES,
  getSuccessTestProjects,
  getAmbiguousTestProjects,
  getPermissionDeniedTestProjects,
  getBossTestProjects,
  getInactiveTestProjects,
  getPhasedTestProjects,
  getPhasedSuccessTestProjects,
  getPhasedAliasTestCases,
  getDefaultTestProject,
  getSpellingCasesForConfiguredProjects,
  getUnresolvableSpellingCasesForConfiguredProjects,
  type MicrositeTestProject as SiteVisitTestProject,
  type MicrositeProjectOutcome as SiteVisitProjectOutcome,
  type MicrositeProjectKind as SiteVisitProjectKind,
  type PhasedAliasTestCase,
  type ProjectSpellingCase,
  type ProjectUnresolvableSpellingCase,
} from './micrositeProjects';

/** Default buyer name used across site visit NLP tests */
export const SITE_VISIT_BUYER_NAME = 'Harsha';

/** Default visit slot appended when a format case omits date/time */
export const SITE_VISIT_DEFAULT_SLOT = 'on tomorrow 11 AM';

/** Buyer ID with an existing microsite for Abhee Tranquila (legacy cases) */
export const SITE_VISIT_LEGACY_BUYER_ID = 'B123';
