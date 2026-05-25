import { randomPhoneNumber } from "./helpers";

export interface MicrositeLeadData {
  buyerName: string;
  phoneNumber: string;
}

export const createMicrositeLeadData = (): MicrositeLeadData => ({
  buyerName: `Buyer ${Date.now()}`,
  phoneNumber: randomPhoneNumber()
});
