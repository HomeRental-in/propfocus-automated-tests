/**
 * Broker phone numbers for access-control tests.
 *
 * MAIN vs SUB are different brokers on dev (see user-journey6).
 * Override via env for other environments.
 */

export const BROKER_PHONE = {
  MAIN_BROKER:
    process.env.MAIN_BROKER_PHONE ??
    process.env.TEST_PHONE ??
    '9999999999',

  SUB_BROKER:
    process.env.SUB_BROKER_PHONE ??
    '9888898888',

  INACTIVE:
    process.env.INACTIVE_BROKER_PHONE ??
    '7777777777',

  SUSPENDED:
    process.env.SUSPENDED_ORG_PHONE ??
    '6666666666',
} as const;

export type BrokerRole = keyof typeof BROKER_PHONE;
