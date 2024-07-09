import { input } from "@inquirer/prompts";
import { SongList } from "./core/google/sheets";

const songList = await SongList.create();

const sheetId = process.env.SHEET_ID ?? (await input({ message: "Digite o ID da planilha:" }));

if (!sheetId) throw new Error("ID da planilha não informado.");

await songList.read(sheetId);
