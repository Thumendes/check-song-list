import { Spotify } from "./core/spotify";

const spotify = await Spotify.create();

console.log(await spotify.searchTracks("Never Gonna Give You Up"));
