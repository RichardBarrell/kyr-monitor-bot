import { Client, TextChannel } from "discord.js";
import { getYamlData } from "./mbYamlData.ts";
import { logToFile, createLogsDir, LogEvent, logErrorToFile } from "./mbLogs.js";
import { monitorOncePerMinute } from "./mbMonitor.ts";
import { getAppSettings } from "./db/mbDbAppSettings.ts";
import { initDatabase, withTransactionSync } from "./db/mbDatabase.ts";
import { oncePerMinuteState } from "./mbOncePerMinute.ts";
import { createUnit, getUnits } from "./db/mbDbUnit.ts";

export async function startupPreClient(): Promise<void> {
  try {
    console.log("Starting boot checks...");

    createLogsDir();
    logToFile(`Logs dir created`, LogEvent.Success);

    initDatabase();
    logToFile("Initialised database", LogEvent.Success);

    const yamlData = await getYamlData();
    logToFile(`data/data.yml cached successfully`, LogEvent.Success);

    getAppSettings();
    logToFile(`verified DB is accessible`, LogEvent.Success);

    const allUnits = getUnits();
    if (allUnits.length === 0) {
      logToFile("No units in DB. Inserting default units:", LogEvent.Warning);
      withTransactionSync(() => {
        for (const unitName of yamlData.defaultUnits) {
          createUnit(unitName);
          logToFile(`Create default unit ${unitName}`);
        }
      });
      logToFile("Created default units", LogEvent.Success);
    }
  } catch (error) {
    logErrorToFile("startupPreClient", error, LogEvent.Alert);
    process.exit(1);
  }
  logToFile(`::Monitor Bot pre-client checks good::`, LogEvent.Success);
}

export async function startupPostClient(client: Client): Promise<void> {
  try {
    oncePerMinuteState.stop();
    oncePerMinuteState.callback = async function oncePerMinute() {
      const yd = await getYamlData();
      const botChannel = await client.channels.fetch(yd.botChannelId);
      if (!botChannel) {
        logToFile("Couldn't find bot channel", LogEvent.Warning);
        return;
      }
      if (!(botChannel instanceof TextChannel)) {
        logToFile("Bot channel isn't a TextChannel", LogEvent.Warning);
        return;
      }
      logToFile("Running monitorOncePerMinute()", LogEvent.Success);
      await monitorOncePerMinute(client, botChannel);
    };
    const appSettings = getAppSettings();
    if (appSettings.shouldRunOnStart) {
      logToFile("Running first monitorOncePerMinute call");
      await oncePerMinuteState.start();
    }
    logToFile(`::Monitor Bot post-client startup good::`, LogEvent.Success);
  } catch (error) {
    logErrorToFile("startupPostClient", error, LogEvent.Alert);
    process.exit(1);
  }
}
