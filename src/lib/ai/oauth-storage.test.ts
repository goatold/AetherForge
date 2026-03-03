import { storeOAuthCredentials, getOAuthCredentials } from "./oauth-storage";
import { encrypt, decrypt } from "../crypto";
import { executeQuery, aiProviderSessionQueries } from "../db";

// Mock dependencies
jest.mock("../crypto", () => ({
  encrypt: jest.fn(),
  decrypt: jest.fn()
}));

jest.mock("../db", () => ({
  executeQuery: jest.fn(),
  aiProviderSessionQueries: {
    upsertOAuthConnected: jest.fn(),
    findConnectedByUser: jest.fn()
  }
}));

describe("OAuth Credential Storage", () => {
  const userId = "user-123";
  const providerKey = "openai";
  const accessToken = "sk-access-token";
  const refreshToken = "rt-refresh-token";
  const encryptedAccess = "iv:tag:encrypted-access";
  const encryptedRefresh = "iv:tag:encrypted-refresh";

  beforeEach(() => {
    jest.clearAllMocks();
    (encrypt as jest.Mock).mockImplementation(async (text) => `iv:tag:encrypted-${text.includes("access") ? "access" : "refresh"}`);
    (decrypt as jest.Mock).mockImplementation(async (text) => text.includes("access") ? accessToken : refreshToken);
  });

  describe("storeOAuthCredentials", () => {
    it("should encrypt tokens and store them in the database", async () => {
      // Setup mock return for DB
      (executeQuery as jest.Mock).mockResolvedValue({
        rows: [{
          id: "session-1",
          user_id: userId,
          provider_key: providerKey,
          mode: "oauth_api",
          status: "connected",
          access_token_enc: encryptedAccess,
          refresh_token_enc: encryptedRefresh,
          created_at: new Date(),
          updated_at: new Date()
        }]
      });

      await storeOAuthCredentials(userId, providerKey, accessToken, refreshToken, 3600, ["scope1"]);

      // Verify encryption was called
      expect(encrypt).toHaveBeenCalledWith(accessToken);
      expect(encrypt).toHaveBeenCalledWith(refreshToken);

      // Verify DB query was called with encrypted values
      expect(aiProviderSessionQueries.upsertOAuthConnected).toHaveBeenCalledWith(
        userId,
        providerKey,
        expect.stringContaining("encrypted-access"),
        expect.stringContaining("encrypted-refresh"),
        expect.any(String), // expiresAt
        ["scope1"],
        "Bearer",
        "{}"
      );
    });
  });

  describe("getOAuthCredentials", () => {
    it("should retrieve and decrypt tokens", async () => {
      // Setup mock return for DB
      (executeQuery as jest.Mock).mockResolvedValue({
        rows: [{
          id: "session-1",
          user_id: userId,
          provider_key: providerKey,
          mode: "oauth_api",
          status: "connected",
          access_token_enc: encryptedAccess,
          refresh_token_enc: encryptedRefresh,
          expires_at: null,
          created_at: new Date(),
          updated_at: new Date()
        }]
      });

      const creds = await getOAuthCredentials(userId);

      expect(creds).toEqual({
        accessToken: accessToken,
        refreshToken: refreshToken,
        expiresAt: null,
        providerKey: providerKey
      });

      expect(decrypt).toHaveBeenCalledWith(encryptedAccess);
      expect(decrypt).toHaveBeenCalledWith(encryptedRefresh);
    });
  });
});
