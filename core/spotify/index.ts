import { SpotifyAuth } from "./auth";
import { type Track, type User } from "./data";

export class Spotify {
  constructor(private token: string, private refreshToken: string) {}

  setToken(token: string) {
    this.token = token;
    return this;
  }

  get credentials() {
    return { token: this.token, refreshToken: this.refreshToken };
  }

  async getMe(): Promise<User | { error: { status: 401; message: "The access token expired" } } | null> {
    if (!this.token) return null;

    try {
      const data = await this.fetchWebApi("v1/me");

      return data;
    } catch (error) {
      console.log(error);
      return null;
    }
  }

  async updateToken() {
    if (!this.refreshToken) {
      console.log(`Não existe refresh token`);
      return null;
    }

    try {
      console.log(`Atualizando token...`);

      const response = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${Buffer.from(
            process.env.SPOTIFY_CLIENT_ID + ":" + process.env.SPOTIFY_CLIENT_SECRET
          ).toString("base64")}`,
        },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: this.refreshToken,
        }),
      });

      const data = await response.json();

      return data;
    } catch (error) {
      console.log(error);
      return null;
    }
  }

  async getTopTracks() {
    try {
      const data = await this.fetchWebApi("v1/me/top/tracks?time_range=short_term&limit=5");

      return data;
    } catch (error) {
      console.log(error);
      return [];
    }
  }

  async getFavoriteTracks() {
    try {
      const acc = [];

      let data = await this.fetchWebApi("v1/me/tracks?limit=50");
      acc.push(...data.items);

      while (data.next) {
        data = await this.fetchWebApi(data.next.replace("https://api.spotify.com/", ""));
        acc.push(...data.items);

        console.log(`Fetched ${acc.length} tracks...`);

        await Bun.sleep(1000);
      }

      console.log(acc);

      return acc;
    } catch (error) {
      console.log(error);
      return [];
    }
  }

  async searchTracks(query: string) {
    try {
      const data = await this.fetchWebApi(`v1/search?q=${query}&type=track&limit=5`);

      return data.tracks.items as Track[];
    } catch (error) {
      console.log(error);
      return [];
    }
  }

  async createPlaylist(name: string, description: string, tracks: string[]) {
    try {
      const data = await this.fetchWebApi(`v1/me/playlists`, "POST", {
        name,
        description,
        public: false,
      });

      const playlistId = data.id;

      await this.addTracksToPlaylist(playlistId, tracks);

      return data;
    } catch (error) {
      console.log(error);
      return null;
    }
  }

  async addTracksToPlaylist(playlistId: string, tracks: string[]) {
    try {
      await this.fetchWebApi(`v1/playlists/${playlistId}/tracks`, "POST", {
        uris: tracks,
      });

      return { ok: true };
    } catch (error) {
      console.log(error);
      return { ok: false, error };
    }
  }

  async fetchWebApi<T>(endpoint: string, method: string = "GET", body?: T): Promise<any> {
    if (!this.token) throw new Error("No token provided");

    const Authorization = `Bearer ${this.token}`;

    const res = await fetch(`https://api.spotify.com/${endpoint}`, {
      method,
      body: JSON.stringify(body),
      headers: { Authorization },
    });

    const data = await res.json();

    return data;
  }

  static async create() {
    const auth = new SpotifyAuth();
    return await auth.getClient();
  }
}
