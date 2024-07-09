import { google, type sheets_v4, type youtube_v3 } from "googleapis";
import { GoogleAuth } from "../auth";
import type { Spotify } from "../../spotify";
import { SpotifyAuth } from "../../spotify/auth";
import { Logger } from "../../utils/logger";

interface Song {
  index: number;
  title: string;
  artist: string;
  video: string;
  isOnPlaylist: boolean;
}

export class SongList {
  private sheetId?: string;
  private logger = new Logger("SongList");

  private constructor(
    private readonly sheets: sheets_v4.Sheets,
    private readonly youtube: youtube_v3.Youtube,
    private readonly spotify: Spotify
  ) {}

  async read(sheetId: string) {
    this.sheetId = sheetId;

    /**
     * Busca os dados da planilha
     */
    this.logger.log("Buscando dados da planilha...");
    const res = await this.sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: "A:D" });

    const rows = res.data.values;

    if (!rows || rows.length === 0) {
      this.logger.warn("No data found.");
      return;
    }

    const [, subHeader, ...songsRows] = rows;

    /**
     * Busca a URL da playlist do Spotify
     */
    const playlistUrl = subHeader[3];
    const playlistId = playlistUrl.match(/playlist\/(.*)/)?.[1];

    this.logger.success(`Playlist ID: ${playlistId}`);

    /**
     * Mapeia as músicas
     */
    const songs = songsRows.map((row, index) => {
      const [title, artist, video, isOnPlaylist] = row;
      return { index: index + 3, title, artist, video, isOnPlaylist: isOnPlaylist === "✅" } as Song;
    });

    /**
     * Para cada música, verifica se já possui vídeo e se está na playlist
     */
    this.logger.info(`Verificando ${songs.length} músicas...`);
    for (const song of songs) {
      this.logger.log(`--- ${song.title} - ${song.artist} ---`);

      await this.checkVideo(song);
      await this.checkPlaylist(song, playlistId);
    }

    this.logger.success("Verificação concluída!");
    process.exit(0);
  }

  async checkVideo(song: Song) {
    const logger = this.logger.withPrefix("checkVideo");

    if (song.video) {
      logger.success("Já possui vídeo:", song.video);
      return;
    }

    const query = `${song.title} ${song.artist} ao vivo`;
    logger.info("Buscando vídeo no YouTube:", query);

    const res = await this.youtube.search.list({
      q: query,
      part: ["snippet"],
      type: ["video"],
    });

    const video = res.data.items?.[0];

    if (!video) {
      logger.warn("Vídeo não encontrado.");
      return;
    }

    const videoId = video.id?.videoId;

    const url = `https://www.youtube.com/watch?v=${videoId}`;

    logger.success("Vídeo encontrado:", url);

    await this.sheets.spreadsheets.values.update({
      spreadsheetId: this.sheetId,
      range: `C${song.index}`,
      valueInputOption: "RAW",
      requestBody: { values: [[url]] },
    });
  }

  async checkPlaylist(song: Song, playlistId: string) {
    if (!playlistId) return;

    const logger = this.logger.withPrefix("checkPlaylist");

    if (song.isOnPlaylist) {
      logger.success("Já está na playlist.");
      return;
    }

    const query = `${song.title} ${song.artist}`;

    logger.info("Buscando música no Spotify:", query);

    const tracks = await this.spotify.searchTracks(query);

    if (tracks.length === 0) {
      logger.warn("Música não encontrada.");
      return;
    }

    const track = tracks[0];
    logger.success("Música encontrada:", track.name);

    const added = await this.spotify.addTracksToPlaylist(playlistId, [track.uri]);

    await this.sheets.spreadsheets.values.update({
      spreadsheetId: this.sheetId,
      range: `D${song.index}`,
      valueInputOption: "RAW",
      requestBody: { values: [[added.ok ? "✅" : `❌ ${added.error}`]] },
    });
  }

  static async create() {
    const logger = new Logger("CreateSongList");

    const googleAuth = new GoogleAuth();
    const spotifyAuth = new SpotifyAuth();

    logger.info("Autenticando com o Google...");
    const client = await googleAuth.getClient();

    const sheets = google.sheets({ version: "v4", auth: client });
    const youtube = google.youtube({ version: "v3", auth: client });

    logger.info("Autenticando com o Spotify...");
    const spotify = await spotifyAuth.getClient();

    logger.success("Autenticado com sucesso!");

    return new SongList(sheets, youtube, spotify);
  }
}
