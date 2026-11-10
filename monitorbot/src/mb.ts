import "./mbLoadEnv.js";
import { Client, DMChannel, Events, GatewayIntentBits, MessageFlags, Partials } from "discord.js";
import * as boot from "./mbBoot.js";
import { logErrorToFile, LogEvent, logToFile } from "./mbLogs.js";
import { replyWithAdminHelp } from "./mbHelp.ts";
import { mkdirSync } from "node:fs";
import { slashCommandDescriptions } from "./mbSlashCommands.ts";
import { installCommandsInGuild } from "./mbSlashCommandsInstall.ts";
import { getYamlData } from "./mbYamlData.ts";

/*
import { getAppSettings, setMyLastPostId } from "./db/mbDbAppSettings.ts";
import { initDatabase } from "./db/mbDatabase.ts";
import { formatTimeSeconds } from "./formatTime.ts";
initDatabase();
setMyLastPostId("1525526931645272147");
console.log("app settings", getAppSettings());
console.log(formatTimeSeconds(86400 * 12));
*/

mkdirSync("./var", { recursive: true });
await boot.startupPreClient();
const client = new Client({
  intents: [
    // This bot needs minimal intents because Discord
    // unconditionally gives you permission to see:
    //  - DMs to the bot
    //  - @mentions to the bot
    //  - messages the bot posted itself
    GatewayIntentBits.Guilds,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel],
});

client.on(Events.ClientReady, async () => {
  try {
    await boot.startupPostClient(client);
  } catch (error) {
    logErrorToFile(`#clientready`, error, LogEvent.Alert);
  }
});

client.on(Events.GuildAvailable, async (guild) => {
  const yamlData = await getYamlData();
  if (guild.id !== yamlData.guildId) {
    logToFile(`Tried to join unknown guild ${guild.id} (${guild.name})`);
    return;
  }
  await installCommandsInGuild(guild);
});

client.on(Events.InteractionCreate, async (interaction) => {
  const yamlData = await getYamlData();
  const { guild } = interaction;
  // ignore commands not from guilds
  if (!guild) return;
  // ignore commands from wrong guild
  if (guild.id !== yamlData.guildId) {
    logToFile(`Received interaction from unknown guild ${guild.id} (${guild.name})`);
    return;
  }
  if (interaction.isChatInputCommand()) {
    const command = slashCommandDescriptions.get(interaction.commandName);
    if (!command) {
      logToFile(`Tried to run unknown slash command ${interaction.commandName}`, LogEvent.Warning);
      return;
    }
    try {
      await command.execute(interaction);
    } catch (error) {
      logErrorToFile(command.execute.name, error, LogEvent.Warning);
      await interaction.followUp({
        content: "An error occurred while executing this command",
        flags: MessageFlags.Ephemeral,
      });
    }
  }
});

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;
  try {
    if (message.channel instanceof DMChannel) {
      await replyWithAdminHelp(message.channel);
    }
  } catch (error) {
    logErrorToFile(`#messageCreate`, error, LogEvent.Alert);
  }
});

client.login(process.env.discordToken);
