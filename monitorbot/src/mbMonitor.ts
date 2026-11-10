import { Client, DiscordAPIError, TextChannel } from "discord.js";
import { getSystemdStatuses, SystemdUnitName, SystemdUnitResult } from "./mbSystemdUnitStatus.ts";
import { getAppSettings, clearMustUpdateOrCreatePost, setMyLastPostId } from "./db/mbDbAppSettings.ts";
import { getLastResultForUnit, saveResultsForUnits, UnitResultRow } from "./db/mbDbUnitsResult.ts";
import { textTimestamp } from "./db/mbDatabase.ts";
import { formatTimeSeconds } from "./formatTime.ts";
import { logErrorToFile, LogEvent, logToFile } from "./mbLogs.ts";
import { getUnitsToCheck } from "./db/mbDbUnit.ts";

const ONE_SECOND = 1000;
const ONE_MINUTE = 60 * ONE_SECOND;
const ONE_HOUR = 60 * ONE_MINUTE;
const makeNewPostAfter = 10 * ONE_HOUR;
const editPostAfter = 15 * ONE_MINUTE;

export async function monitorOncePerMinute(_client: Client, botChannel: TextChannel) {
  const { myLastPostId, mustUpdatePost, mustCreatePost } = getAppSettings();
  const unitsToCheck = getUnitsToCheck();
  const [systemdStatuses, myLastPost] = await Promise.all([
    getSystemdStatuses(unitsToCheck.map((unit) => unit.unitName)),
    getMyLastPost(myLastPostId, botChannel),
  ]);

  const changed: { unitName: SystemdUnitName; lastState: UnitResultRow; unitStatus: SystemdUnitResult }[] = [];
  const nowTs = textTimestamp();

  let content = `## Monitor result:\n-# (updated ${nowTs})\n`;
  for (const [unitName, unitStatus] of systemdStatuses) {
    if ("error" in unitStatus) {
      logErrorToFile(`getSystemdStatuses:${unitName}`, unitStatus.error, LogEvent.Warning);
      content += `\n 🧨🧨🧨 Error getting state for **${unitName}**: ${unitStatus.error} 🧨🧨🧨`;
    } else {
      content += `\n ${pickTrafficLight(unitStatus)} **${unitName}**: ${formatUnitStatus(unitStatus)}`;
    }
    const summariseStatus = (status: SystemdUnitResult) => ("error" in status ? "error" : `good-${status.activeState}`);
    const lastStatus = getLastResultForUnit(unitName);
    if (lastStatus && summariseStatus(lastStatus) !== summariseStatus(unitStatus)) {
      changed.push({ unitName, lastState: lastStatus, unitStatus });
    }
  }

  saveResultsForUnits(systemdStatuses.entries());

  const now = Date.now();
  if (myLastPost == null || mustCreatePost || now >= myLastPost.createdTimestamp + makeNewPostAfter) {
    const newPost = await botChannel.send({ content });
    setMyLastPostId(newPost.id);
    logToFile("Created a new post", LogEvent.Success);
  } else if (
    myLastPost != null &&
    (changed.length > 0 ||
      mustUpdatePost ||
      now >= (myLastPost.editedTimestamp ?? myLastPost.createdTimestamp) + editPostAfter)
  ) {
    myLastPost.edit({ content });
    myLastPost.editedTimestamp = now;
    logToFile("Updated my last post", LogEvent.Success);
  }

  if (changed.length > 0) {
    let changeMessage = `-# State changes seen at ${nowTs}\n`;
    for (const { unitName, lastState, unitStatus } of changed) {
      const oldTrafficLight = pickTrafficLight(lastState);
      const newTrafficLight = pickTrafficLight(unitStatus);
      const newFormatted = formatUnitStatus(unitStatus);
      changeMessage += `- **${unitName}** went from ${oldTrafficLight} → ${newTrafficLight}. ${newFormatted}.\n`;
    }
    await botChannel.send({ content: changeMessage });
    logToFile("Sent change message", LogEvent.Success);
  }

  clearMustUpdateOrCreatePost();
}

async function getMyLastPost(myLastPostId: string | null, botChannel: TextChannel) {
  if (myLastPostId == null) return null;
  try {
    return await botChannel.messages.fetch(myLastPostId);
  } catch (error) {
    if (error instanceof DiscordAPIError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

function pickTrafficLight(unitStatus: SystemdUnitResult): string {
  if ("error" in unitStatus) {
    return "🧨";
  }
  const { activeState, subState } = unitStatus;
  switch (activeState) {
    case "active":
      if (subState === "running") {
        return "💚";
      }
      return "😴";
    case "activating":
      return "🥱";
    case "inactive":
      return "💀";
    default:
      return "❓";
  }
}

function formatUnitStatus(unitStatus: SystemdUnitResult): string {
  if ("error" in unitStatus) {
    return `Error getting state: ${unitStatus.error}`;
  }
  const { activeState, subState, activeTime } = unitStatus;
  switch (activeState) {
    case "active":
      let line = "Active";
      if (subState === "running") {
        line += "+running";
      }
      if (activeTime != null) {
        line += ` for ${formatTimeSeconds(activeTime)}`;
      }
      return line;
    case "activating":
      return "Activating";
    case "inactive":
      return "Inactive";
    default:
      return `State "${activeState}"`;
  }
}
