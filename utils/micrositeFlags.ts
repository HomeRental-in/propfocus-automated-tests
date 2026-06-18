/**
 * Microsite prompt flags — keywords appended after the project name.
 *
 * Dashboard lead-type filters (All Leads / Archived) use display labels
 * that may differ from the prompt keyword (e.g. "investor" → Investment).
 */

export type MicrositeFlagAssertType = 'rnr' | 'link' | 'ambiguous';

export interface MicrositeFlagDefinition {
  /** Stable id for test names */
  id: string;
  /** Primary keyword used in prompts */
  keyword: string;
  /** Case variants to exercise parser normalization */
  caseVariants: string[];
  /** Dashboard Lead type filter label, when applicable */
  dashboardLeadType?: string;
  /** How to assert the webhook response */
  assertType: MicrositeFlagAssertType;
  /** Unique buyer first name prefix for dashboard search */
  buyerPrefix: string;
}

export const MICROSITE_FLAGS: MicrositeFlagDefinition[] = [
  {
    id: 'rnr',
    keyword: 'rnr',
    caseVariants: ['rnr', 'Rnr', 'RNR', 'RnR'],
    dashboardLeadType: 'RNR',
    assertType: 'rnr',
    buyerPrefix: 'FlagRnr',
  },
  {
    id: 'old',
    keyword: 'old',
    caseVariants: ['old', 'Old', 'OLD', 'oLd'],
    assertType: 'link',
    buyerPrefix: 'FlagOld',
  },
  {
    id: 'old_data',
    keyword: 'old data',
    caseVariants: ['old data', 'Old Data', 'OLD DATA', 'old  data'],
    assertType: 'link',
    buyerPrefix: 'FlagOldData',
  },
  {
    id: 'data',
    keyword: 'data',
    caseVariants: ['data', 'Data', 'DATA', 'dAta'],
    assertType: 'link',
    buyerPrefix: 'FlagData',
  },
  {
    id: 'referral',
    keyword: 'referral',
    caseVariants: ['referral', 'Referral', 'REFERRAL', 'ReFeRrAl'],
    dashboardLeadType: 'Referral',
    assertType: 'link',
    buyerPrefix: 'FlagReferral',
  },
  {
    id: 'refer',
    keyword: 'refer',
    caseVariants: ['refer', 'Refer', 'REFER', 'ReFeR'],
    dashboardLeadType: 'Referral',
    assertType: 'link',
    buyerPrefix: 'FlagRefer',
  },
  {
    id: 'investor',
    keyword: 'investor',
    caseVariants: ['investor', 'Investor', 'INVESTOR', 'InVeStOr'],
    dashboardLeadType: 'Investment',
    assertType: 'link',
    buyerPrefix: 'FlagInvestor',
  },
  {
    id: 'investment',
    keyword: 'investment',
    caseVariants: ['investment', 'Investment', 'INVESTMENT', 'InVeStMeNt'],
    dashboardLeadType: 'Investment',
    assertType: 'link',
    buyerPrefix: 'FlagInvestment',
  },
];

/** Pairs of flags that must not appear in the same prompt */
export const FLAG_AMBIGUITY_CASES: Array<{
  name: string;
  buildBody: (buyerId: string) => string;
}> = [
  {
    name: 'rnr + referral (Unnati)',
    buildBody: (id) =>
      `FlagAmbig with ID ${id} for Unnati rnr referral`,
  },
  {
    name: 'referral + investor (no project)',
    buildBody: (id) => `FlagAmbig with ID ${id} referral investor`,
  },
  {
    name: 'rnr + investor + referral (no project)',
    buildBody: (id) => `FlagAmbig with ID ${id} rnr investor referral`,
  },
  {
    name: 'referral + investment (no project)',
    buildBody: (id) => `FlagAmbig with ID ${id} referral investment`,
  },
  {
    name: 'investor + referral (no project)',
    buildBody: (id) => `FlagAmbig with ID ${id} investor referral`,
  },
];

import { getBossTestProjects, getPhasedSuccessTestProjects } from './micrositeProjects';

/** Boss / phased projects exercised with each flag keyword */
export const FLAG_BOSS_PHASED_PROJECTS = [
  ...getPhasedSuccessTestProjects()
    .filter((p) =>
      ['Sumadhura Solace Phase 1', 'KNS Samooha Phase 1', 'KNS Ananta Phase 1'].includes(
        p.name
      )
    )
    .map((p) => p.aliases?.[0] ?? p.name),
  ...getBossTestProjects().map((p) => p.name),
];

export function buildFlagPrompt(
  buyerName: string,
  buyerId: string,
  project: string,
  flagKeyword: string
): string {
  return `${buyerName} with ID ${buyerId} for ${project} ${flagKeyword}`;
}

export function getFlagById(id: string): MicrositeFlagDefinition {
  const flag = MICROSITE_FLAGS.find((f) => f.id === id);
  if (!flag) {
    throw new Error(`Unknown microsite flag id: ${id}`);
  }
  return flag;
}
