import { expect, Page } from "@playwright/test";
import { clearAndType, clickWhenReady, waitForVisible } from "../utils/helpers";
import { MicrositeLeadData } from "../utils/testData";

export class MicrositePage {
  private readonly micrositeForm;
  private readonly buyerNameInput;
  private readonly phoneNumberInput;
  private readonly generateMicrositeButton;
  private readonly successToast;
  private readonly generatedLinkField;

  constructor(private readonly page: Page) {
    this.micrositeForm = page.getByTestId("microsite-form");
    this.buyerNameInput = page.getByTestId("microsite-buyer-name");
    this.phoneNumberInput = page.getByTestId("microsite-phone-number");
    this.generateMicrositeButton = page.getByTestId("microsite-generate-button");
    this.successToast = page.getByTestId("toast-success");
    this.generatedLinkField = page.getByTestId("microsite-generated-url");
  }

  async ensureLoaded(): Promise<void> {
    await expect(this.micrositeForm).toBeVisible();
  }

  async fillBuyerLeadDetails(data: MicrositeLeadData): Promise<void> {
    await clearAndType(this.buyerNameInput, data.buyerName);
    await clearAndType(this.phoneNumberInput, data.phoneNumber);
  }

  async generateMicrositeAndGetUrl(): Promise<string> {
    await clickWhenReady(this.generateMicrositeButton);
    await waitForVisible(this.successToast);
    await expect(this.generatedLinkField).toBeVisible();

    const url = (await this.generatedLinkField.inputValue()).trim();
    expect(url, "Expected generated microsite URL to be populated").toContain("http");
    return url;
  }

  async expectBuyerNameOnMicrosite(buyerName: string): Promise<void> {
    const buyerNameLabel = this.page.getByTestId("buyer-name");
    await expect(buyerNameLabel).toHaveText(buyerName);
  }
}
