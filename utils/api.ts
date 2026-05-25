import { APIRequestContext, APIResponse, request } from "@playwright/test";

export interface ApiClientOptions {
  baseUrl: string;
  authToken?: string;
}

export class ApiClient {
  private readonly contextPromise: Promise<APIRequestContext>;

  constructor(private readonly options: ApiClientOptions) {
    this.contextPromise = request.newContext({
      baseURL: options.baseUrl,
      extraHTTPHeaders: options.authToken
        ? {
            Authorization: `Bearer ${options.authToken}`
          }
        : undefined
    });
  }

  async get(path: string): Promise<APIResponse> {
    const context = await this.contextPromise;
    return context.get(path);
  }

  async post(path: string, payload: unknown): Promise<APIResponse> {
    const context = await this.contextPromise;
    return context.post(path, { data: payload });
  }

  async dispose(): Promise<void> {
    const context = await this.contextPromise;
    await context.dispose();
  }
}
