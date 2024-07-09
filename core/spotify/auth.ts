import { Spotify } from ".";
import { $ } from "bun";
import { Logger } from "../utils/logger";

export class SpotifyAuth {
  private logger = new Logger("SpotifyAuth");

  static SCOPES = [
    "user-read-private",
    "user-read-email",
    "user-library-modify",
    "user-library-read",
    "user-top-read",
    "user-read-recently-played",
    "user-follow-read",
    "playlist-read-private",
    "playlist-read-collaborative",
    "playlist-modify-private",
    "playlist-modify-public",
  ];

  static TOKEN_PATH = "storage/spotify/token.json" as const;

  private client?: Spotify;

  async getClient() {
    if (this.client) {
      return this.client;
    }

    const existing = await this.loadSavedCredentialsIfExist();

    if (existing) {
      this.client = existing;
      return existing;
    }

    const client = await this.authenticate();

    if (client.credentials) {
      await this.saveCredentials(client);
    }

    this.client = client;
    return client;
  }

  private async loadSavedCredentialsIfExist() {
    try {
      const file = Bun.file(SpotifyAuth.TOKEN_PATH);
      const credentials = await file.json();

      if (!credentials || !credentials.token || !credentials.refreshToken) return null;

      return new Spotify(credentials.token, credentials.refreshToken);
    } catch (err) {
      return null;
    }
  }

  private async saveCredentials(client: Spotify) {
    const payload = JSON.stringify(client.credentials);
    await Bun.write(SpotifyAuth.TOKEN_PATH, payload);
  }

  private async authenticate() {
    const credentials = await new Promise<{ token: string; refreshToken: string }>(async (resolve, reject) => {
      try {
        const server = Bun.serve({
          port: "8888",
          fetch: async (req, server) => {
            // Search Params
            const url = new URL(req.url);
            const code = url.searchParams.get("code");
            const error = url.searchParams.get("error");

            if (error) {
              reject(new Error(error));
              return new Response("Error: " + error);
            }

            if (!code) {
              reject(new Error("Code not found"));
              return new Response("Error: Code not found");
            }

            const { access_token, refresh_token } = await this.getCredentials(code, server.url.origin);

            resolve({ token: access_token, refreshToken: refresh_token });

            return new Response("Hello, World!");
          },
        });

        const origin = server.url.origin;
        this.logger.info(`Server running at ${origin}`);

        const url = this.getLoginUrl(origin);
        this.logger.info(`Opening browser to login...`);

        await $`open ${url}`;
      } catch (error) {
        reject(error);
      }
    });

    return new Spotify(credentials.token, credentials.refreshToken);
  }

  private getLoginUrl(origin: string) {
    const url = new URL("https://accounts.spotify.com/authorize");

    url.searchParams.set("client_id", process.env.SPOTIFY_CLIENT_ID || "");
    url.searchParams.set("response_type", "code");
    // url.searchParams.set("redirect_uri", origin + "/api/spotify/callback");
    url.searchParams.set("redirect_uri", origin + "/callback");
    url.searchParams.set("scope", SpotifyAuth.SCOPES.join(" "));

    return url.toString();
  }

  private async getCredentials(code: string, origin: string) {
    const authKey = process.env.SPOTIFY_CLIENT_ID + ":" + process.env.SPOTIFY_CLIENT_SECRET;
    const Authorization = `Basic ${Buffer.from(authKey).toString("base64")}`;

    const response = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: origin + "/callback",
      }),
      headers: {
        Authorization,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });

    const data = await response.json();

    return data as { access_token: string; refresh_token: string };
  }
}
