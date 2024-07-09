import { authenticate } from "@google-cloud/local-auth";
import type { OAuth2Client } from "google-auth-library";
import { google } from "googleapis";

export class GoogleAuth {
  static SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/userinfo.profile",
    "https://www.googleapis.com/auth/youtube",
    "https://www.googleapis.com/auth/youtubepartner",
  ];

  static TOKEN_PATH = "storage/google/token.json" as const;
  static CREDENTIALS_PATH = "storage/google/credentials.json" as const;

  private client?: OAuth2Client;

  private async loadSavedCredentialsIfExist() {
    try {
      const file = Bun.file(GoogleAuth.TOKEN_PATH);
      const credentials = await file.json();
      const auth = google.auth.fromJSON(credentials) as OAuth2Client;

      return auth;
    } catch (err) {
      return null;
    }
  }

  private async saveCredentials(client: OAuth2Client) {
    const file = Bun.file(GoogleAuth.CREDENTIALS_PATH);
    const keys = await file.json();
    const key = keys.installed || keys.web;

    const payload = JSON.stringify({
      type: "authorized_user",
      client_id: key.client_id,
      client_secret: key.client_secret,
      refresh_token: client.credentials.refresh_token,
    });

    await Bun.write(GoogleAuth.TOKEN_PATH, payload);
  }

  async getClient() {
    if (this.client) {
      return this.client;
    }

    const existing = await this.loadSavedCredentialsIfExist();

    if (existing) {
      this.client = existing;
      return existing;
    }

    const client = await authenticate({
      scopes: GoogleAuth.SCOPES,
      keyfilePath: GoogleAuth.CREDENTIALS_PATH,
    });

    if (client.credentials) {
      await this.saveCredentials(client);
    }

    this.client = client;
    return client;
  }
}
