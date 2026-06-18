/**
 * Microsite generation test projects.
 *
 * Project names sourced from https://dev.propfocus.in/api/projects
 * Fill in PROJECT_SPELLING_VARIANTS with typos brokers actually type.
 */

export type MicrositeProjectOutcome =
  | 'success'
  | 'ambiguous'
  | 'permission_denied'
  | 'inactive';

export type MicrositeProjectKind =
  | 'standard'
  | 'boss'
  | 'phased'
  | 'inactive';

export interface MicrositeTestProject {
  /** Canonical project name as stored in the system */
  name: string;
  /** Short forms users might type instead of the full name */
  aliases?: string[];
  /** Include in multi-project generation tests (default: true) */
  includeInMultiProject?: boolean;
  /** Boss / phased / inactive — used by special-project suites */
  projectKind?: MicrositeProjectKind;
  /**
   * Expected result when the automation broker generates a microsite.
   * - success: link is returned (default)
   * - ambiguous: clarification — multiple matches, no link
   * - permission_denied: broker lacks access, no link
   * - inactive: project is inactive in admin (dev may still return a link)
   */
  expectedOutcome?: MicrositeProjectOutcome;
}

export interface PhasedAliasTestCase {
  /** What the broker types */
  alias: string;
  /** Canonical phased project name in MICROSITE_TEST_PROJECTS */
  resolvesTo: string;
}

/**
 * Projects to run single- and multi-project microsite generation tests against.
 */
export const MICROSITE_TEST_PROJECTS: MicrositeTestProject[] = [
  // --------------------------------------------------
  // Abhee (existing default — used by NLP format matrix)
  // --------------------------------------------------
  {
    name: 'Abhee Tranquila',
    aliases: ['Tranquila'],
    includeInMultiProject: true,
  },

  // --------------------------------------------------
  // Amberstone
  // --------------------------------------------------
  {
    name: 'Amberstone Codename Lake One',
    aliases: ['Codename Lake One', 'Lake One'],
    includeInMultiProject: false,
  },
  {
    name: 'Amberstone Codename Sleek',
    aliases: ['Codename Sleek', 'Sleek'],
    includeInMultiProject: false,
  },
  {
    name: 'Amberstone Ventara',
    aliases: ['Ventara'],
    includeInMultiProject: true,
  },

  // --------------------------------------------------
  // Hosachiguru
  // --------------------------------------------------
  {
    name: 'Hosachiguru Samruddhi',
    aliases: ['Samruddhi'],
    includeInMultiProject: false,
  },
  {
    name: 'Hosachiguru Madhuvana',
    aliases: ['Madhuvana'],
    includeInMultiProject: false,
    expectedOutcome: 'permission_denied',
  },
  {
    name: 'Hosachiguru Maamara',
    aliases: ['Maamara'],
    includeInMultiProject: false,
  },
  {
    name: 'Hosachiguru Unnati - Farm Villa Plots',
    aliases: ['Unnati', 'Hosachiguru Unnati'],
    includeInMultiProject: true,
  },
  {
    name: 'Hosachiguru Eco Habitat',
    aliases: ['Eco Habitat'],
    includeInMultiProject: false,
  },
  {
    name: 'Hosachiguru Dharani',
    aliases: ['Dharani'],
    includeInMultiProject: false,
  },
  {
    name: 'Hosachiguru Abhivrudhi',
    aliases: ['Abhivrudhi'],
    includeInMultiProject: false,
  },
  {
    name: 'Hosachiguru Aamrut',
    aliases: ['Aamrut'],
    includeInMultiProject: false,
  },

  // --------------------------------------------------
  // KNS
  // --------------------------------------------------
  {
    name: 'KNS Sampada',
    aliases: ['Sampada'],
    includeInMultiProject: true,
  },
  {
    name: 'KNS Samooha Phase 1',
    aliases: ['KNS Samooha', 'Samooha'],
    includeInMultiProject: false,
  },
  {
    name: 'KNS Samooha Phase 2',
    includeInMultiProject: false,
  },
  {
    name: 'KNS Samooha Phase 3',
    includeInMultiProject: false,
  },
  {
    name: 'KNS Ananta Phase 1',
    aliases: ['KNS Ananta', 'Ananta'],
    includeInMultiProject: false,
  },
  {
    name: 'KNS Ananta Phase 2',
    includeInMultiProject: false,
  },
  {
    name: 'KNS Ananta Phase 3',
    includeInMultiProject: false,
  },
  {
    name: 'KNS Laurel Phase 1',
    aliases: ['KNS Laurel', 'Laurel'],
    includeInMultiProject: false,
  },
  {
    name: 'KNS Laurel Phase 2',
    includeInMultiProject: false,
  },
  {
    name: 'KNS Aura',
    aliases: ['Aura'],
    includeInMultiProject: false,
    expectedOutcome: 'ambiguous',
  },
  {
    name: 'KNS Fresco',
    aliases: ['Fresco'],
    includeInMultiProject: false,
    expectedOutcome: 'ambiguous',
  },
  {
    name: 'KNS Unnati Phase 5',
    aliases: ['KNS Unnati'],
    includeInMultiProject: false,
  },
  {
    name: 'KNS Athena phase 1',
    aliases: ['KNS Athena', 'Athena'],
    includeInMultiProject: false,
    expectedOutcome: 'ambiguous',
  },
  {
    name: 'KNS Athena phase 2',
    includeInMultiProject: false,
    expectedOutcome: 'ambiguous',
  },
  {
    name: 'KNS Amora',
    aliases: ['Amora'],
    includeInMultiProject: false,
    expectedOutcome: 'ambiguous',
  },
  {
    name: 'KNS Sumedha',
    aliases: ['Sumedha'],
    includeInMultiProject: false,
  },
  {
    name: 'KNS Calisto Phase 1',
    aliases: ['KNS Calisto', 'Calisto'],
    includeInMultiProject: false,
    expectedOutcome: 'ambiguous',
  },
  {
    name: 'KNS Calisto Phase 2',
    includeInMultiProject: false,
    expectedOutcome: 'ambiguous',
  },
  {
    name: 'KNS Billore',
    aliases: ['Billore'],
    includeInMultiProject: false,
  },
  {
    name: 'KNS Anagha Phase 2',
    aliases: ['KNS Anagha', 'Anagha'],
    includeInMultiProject: false,
  },
  {
    name: 'KNS Candrill Phase 2',
    aliases: ['KNS Candrill', 'Candrill'],
    includeInMultiProject: false,
    expectedOutcome: 'ambiguous',
  },

  // --------------------------------------------------
  // Pride Group
  // Note: "Pride World City" not found on dev API — Pride projects below.
  // --------------------------------------------------
  {
    name: 'Pride Crosswinds Villas',
    aliases: ['Crosswinds', 'Pride Crosswinds'],
    includeInMultiProject: false,
  },
  {
    name: 'Pride Euphora',
    aliases: ['Euphora'],
    includeInMultiProject: true,
  },

  // --------------------------------------------------
  // Sumadhura
  // --------------------------------------------------
  {
    name: 'Sumadhura Solace Phase 1',
    aliases: ['Sumadhura Solace', 'Solace'],
    includeInMultiProject: true,
  },
  {
    name: 'Sumadhura Solace Phase 2',
    includeInMultiProject: false,
  },
  {
    name: 'Sumadhura Palais Royale',
    aliases: ['Palais Royale'],
    includeInMultiProject: false,
  },
  {
    name: 'Sumadhura Olympus',
    aliases: ['Olympus'],
    includeInMultiProject: false,
  },
  {
    name: 'Sumadhura Gardens By Brook',
    aliases: ['Gardens By Brook'],
    includeInMultiProject: false,
  },
  {
    name: 'Sumadhura Folium - Phase 4',
    aliases: ['Sumadhura Folium', 'Folium'],
    includeInMultiProject: false,
  },
  {
    name: 'Sumadhura Edition',
    aliases: ['Edition'],
    includeInMultiProject: false,
  },
  {
    name: 'Sumadhura Sarang',
    aliases: ['Sarang'],
    includeInMultiProject: false,
  },
  {
    name: 'Sumadhura Pramoda',
    aliases: ['Pramoda'],
    includeInMultiProject: false,
  },
  {
    name: 'Sumadhura Panorama',
    aliases: ['Panorama'],
    includeInMultiProject: false,
  },
  {
    name: 'Sumadhura Epitome',
    aliases: ['Epitome'],
    includeInMultiProject: false,
  },
  {
    name: 'Sumadhura Capitol Residences',
    aliases: ['Capitol Residences'],
    includeInMultiProject: false,
  },
];

// --------------------------------------------------
// Boss projects — pseudo-projects (not in admin catalog)
// --------------------------------------------------
export const BOSS_TEST_PROJECTS: MicrositeTestProject[] = [
  {
    name: 'Farm Showcase',
    projectKind: 'boss',
    includeInMultiProject: false,
  },
  {
    name: 'Farm Land Expo',
    projectKind: 'boss',
    includeInMultiProject: false,
  },
  {
    name: 'All Projects',
    projectKind: 'boss',
    includeInMultiProject: false,
  },
];

// --------------------------------------------------
// Inactive projects — is_active=false on dev API
// --------------------------------------------------
export const INACTIVE_TEST_PROJECTS: MicrositeTestProject[] = [
  {
    name: 'Nyati Evania',
    projectKind: 'inactive',
    expectedOutcome: 'inactive',
    includeInMultiProject: false,
  },
  {
    name: 'Copy of Elegant Atmos',
    projectKind: 'inactive',
    expectedOutcome: 'inactive',
    includeInMultiProject: false,
  },
  {
    name: 'Abhee Aaria',
    aliases: ['Aaria'],
    projectKind: 'inactive',
    expectedOutcome: 'ambiguous',
    includeInMultiProject: false,
  },
];

/**
 * Phased project alias resolution — broker types short name, parser picks a phase.
 */
export const PHASED_ALIAS_TEST_CASES: PhasedAliasTestCase[] = [
  { alias: 'KNS Samooha', resolvesTo: 'KNS Samooha Phase 1' },
  { alias: 'Samooha', resolvesTo: 'KNS Samooha Phase 1' },
  { alias: 'KNS Ananta', resolvesTo: 'KNS Ananta Phase 1' },
  { alias: 'Ananta', resolvesTo: 'KNS Ananta Phase 1' },
  { alias: 'Sumadhura Solace', resolvesTo: 'Sumadhura Solace Phase 1' },
  { alias: 'Solace', resolvesTo: 'Sumadhura Solace Phase 1' },
  { alias: 'KNS Laurel', resolvesTo: 'KNS Laurel Phase 1' },
  { alias: 'Laurel', resolvesTo: 'KNS Laurel Phase 1' },
];

export interface ProjectSpellingCase {
  /** Must match `name` from MICROSITE_TEST_PROJECTS */
  canonicalName: string;
  /**
   * Misspellings / fuzzy inputs users commonly send.
   * Tests expect generation to succeed and resolve to canonicalName.
   */
  misspellings: string[];
}

/**
 * Spelling mistake matrix per project.
 */
export const PROJECT_SPELLING_VARIANTS: ProjectSpellingCase[] = [
  {
    canonicalName: 'Abhee Tranquila',
    misspellings: [
      'Abhee Tranqula',
      'Abhee Tranquilla',
      'Abhee Tranquilia',
      'Abhi Tranquila',
      'Abhee Trankila',
      'Tranqula',
    ],
  },
  {
    canonicalName: 'KNS Sampada',
    misspellings: [
      'KNS Sampda',
      'Kns Sampada',
      'kns sampada',
      'KNS sampda',
      'Sampada',
    ],
  },
  {
    canonicalName: 'Amberstone Ventara',
    misspellings: [
      'Amberstone Ventra',
      'Amberston Ventara',
      'Ventara',
    ],
  },
  {
    canonicalName: 'Hosachiguru Unnati - Farm Villa Plots',
    misspellings: [
      'Hosachiguru Unati',
      'Hosachiguru Unnati',
      'Unnati',
      'Hosachiguru Unnati Farm Villa Plots',
    ],
  },
  {
    canonicalName: 'KNS Samooha Phase 1',
    misspellings: [
      'KNS Samooha',
      'KNS Smooha',
      'KNS Samoha',
      'Samooha',
    ],
  },
  {
    canonicalName: 'KNS Ananta Phase 1',
    misspellings: [
      'KNS Ananta',
      'Kns Ananta Phase 1',
      'Ananta',
    ],
  },
  {
    canonicalName: 'Pride Euphora',
    misspellings: [
      'Pride Euphoria',
      'Pride Eupora',
      'Euphora',
    ],
  },
  {
    canonicalName: 'Sumadhura Solace Phase 1',
    misspellings: [
      'Sumadhura Solace',
      'Sumadhura Solce',
      'Sumadhura Solace Phase1',
      'Solace',
    ],
  },
];

/** Misspellings that are too far off — parser should fail gracefully (no link). */
export interface ProjectUnresolvableSpellingCase {
  canonicalName: string;
  misspellings: string[];
}

export const PROJECT_UNRESOLVABLE_SPELLINGS: ProjectUnresolvableSpellingCase[] = [
  {
    canonicalName: 'Abhee Tranquila',
    misspellings: ['XYZ Unknown Tower'],
  },
];

// ======================================================
// HELPERS
// ======================================================

export function getSuccessTestProjects(): MicrositeTestProject[] {
  return MICROSITE_TEST_PROJECTS.filter(
    (project) => (project.expectedOutcome ?? 'success') === 'success'
  );
}

/** @deprecated Use getSuccessTestProjects */
export function getAutomationTestProjects(): MicrositeTestProject[] {
  return getSuccessTestProjects();
}

export function getAmbiguousTestProjects(): MicrositeTestProject[] {
  return MICROSITE_TEST_PROJECTS.filter(
    (project) => project.expectedOutcome === 'ambiguous'
  );
}

export function getPermissionDeniedTestProjects(): MicrositeTestProject[] {
  return MICROSITE_TEST_PROJECTS.filter(
    (project) => project.expectedOutcome === 'permission_denied'
  );
}

export function getBossTestProjects(): MicrositeTestProject[] {
  return BOSS_TEST_PROJECTS;
}

export function getInactiveTestProjects(): MicrositeTestProject[] {
  return INACTIVE_TEST_PROJECTS;
}

export function getPhasedTestProjects(): MicrositeTestProject[] {
  return MICROSITE_TEST_PROJECTS.filter((project) =>
    /phase/i.test(project.name)
  );
}

export function getPhasedSuccessTestProjects(): MicrositeTestProject[] {
  return getPhasedTestProjects().filter(
    (project) => (project.expectedOutcome ?? 'success') === 'success'
  );
}

export function getPhasedAliasTestCases(): PhasedAliasTestCase[] {
  return PHASED_ALIAS_TEST_CASES;
}

export function getAllSpecialCategoryProjects(): MicrositeTestProject[] {
  return [
    ...BOSS_TEST_PROJECTS,
    ...INACTIVE_TEST_PROJECTS,
    ...getPhasedSuccessTestProjects(),
    ...getPermissionDeniedTestProjects(),
    ...getAmbiguousTestProjects(),
  ];
}

export function getDefaultTestProject(): MicrositeTestProject {
  const project = MICROSITE_TEST_PROJECTS[0];
  if (!project) {
    throw new Error(
      'MICROSITE_TEST_PROJECTS is empty — add at least one project in utils/micrositeProjects.ts'
    );
  }
  return project;
}

export function getMultiProjectTestNames(): string[] {
  return MICROSITE_TEST_PROJECTS.filter(
    (project) =>
      project.includeInMultiProject !== false &&
      (project.expectedOutcome ?? 'success') === 'success'
  ).map((project) => project.name);
}

export function getSpellingCasesForConfiguredProjects(): ProjectSpellingCase[] {
  const configuredNames = new Set(
    MICROSITE_TEST_PROJECTS.map((project) => project.name)
  );

  return PROJECT_SPELLING_VARIANTS.filter((spellingCase) =>
    configuredNames.has(spellingCase.canonicalName)
  );
}

export function getUnresolvableSpellingCasesForConfiguredProjects(): ProjectUnresolvableSpellingCase[] {
  const configuredNames = new Set(
    MICROSITE_TEST_PROJECTS.map((project) => project.name)
  );

  return PROJECT_UNRESOLVABLE_SPELLINGS.filter((spellingCase) =>
    configuredNames.has(spellingCase.canonicalName)
  );
}
