import { createHash } from "node:crypto";
import { walk } from "canonical-json";
import { SlashCommandDescription, slashCommandDescriptions } from "./mbSlashCommands.ts";
import { Guild, Routes } from "discord.js";
import { LogEvent, logToFile } from "./mbLogs.ts";
import { getGuildInfo, setGuildInfoSlashCommandsHash } from "./db/mbDbGuildInfo.ts";

function hashSlashCommands(iterCommands: Iterable<SlashCommandDescription>) {
  const commands = Array.from(iterCommands);
  commands.sort((a, b) => {
    if (a.data.name > b.data.name) return 1;
    if (a.data.name < b.data.name) return -1;
    return 0;
  });
  const hash = createHash("sha256");
  walk(commands, (chunk) => hash.update(chunk));
  return hash.digest("hex");
}

const slashCommandsHash = hashSlashCommands(slashCommandDescriptions.values());

export async function installCommandsInGuild(guild: Guild) {
  const guildInfo = getGuildInfo(guild.id);
  const lastSlashCommandsHash = guildInfo.slashCommandsHash;
  if (lastSlashCommandsHash === slashCommandsHash) {
    logToFile(`Slash commands match already installed value for guild ${guild.name}`, LogEvent.Success);
    return;
  }

  const client = guild.client;
  const rest = client.rest;
  const commandsArray = Array.from(slashCommandDescriptions.values(), (descr) => descr.data.toJSON());
  await rest.put(Routes.applicationGuildCommands(client.application.id, guild.id), { body: commandsArray });
  logToFile(`Registered slash commands for guild ${guild.name}`);
  setGuildInfoSlashCommandsHash(guild.id, slashCommandsHash);
  logToFile("Saved slash command hash");
}
