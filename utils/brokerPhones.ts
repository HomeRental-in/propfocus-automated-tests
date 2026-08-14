/**
 * Broker phone numbers for access-control tests.
 *
 * MAIN vs SUB are different brokers on the automation roster
 * (see utils/testRoster.ts). Override via env for other environments.
 */

import { ROSTER } from './testRoster';

export const BROKER_PHONE = {
  MAIN_BROKER: ROSTER.mainBroker,
  SUB_BROKER: ROSTER.subBroker,
  INACTIVE: ROSTER.inactive,
  SUSPENDED: ROSTER.suspended,
} as const;

export type BrokerRole = keyof typeof BROKER_PHONE;
