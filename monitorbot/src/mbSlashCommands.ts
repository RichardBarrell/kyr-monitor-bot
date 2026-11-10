import { ChatInputCommandInteraction, SlashCommandBuilder, SlashCommandOptionsOnlyBuilder } from "discord.js";
import { oncePerMinuteState } from "./mbOncePerMinute.ts";
import { setMustCreatePost, setMustUpdatePost, setShouldRunOnStart } from "./db/mbDbAppSettings.ts";
import { getSystemdStatuses } from "./mbSystemdUnitStatus.ts";
import { createUnit, deleteUnit, getUnits, setUnitShouldCheck } from "./db/mbDbUnit.ts";
import { withTransactionSync } from "./db/mbDatabase.ts";

export type SlashCommandDescription = {
  data: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
};
export const slashCommandDescriptions = new Map<string, SlashCommandDescription>();

const addSlashCommand = (s: SlashCommandDescription) => {
  slashCommandDescriptions.set(s.data.name, s);
};

const guildAdminsOnlyPermission = "8";

addSlashCommand({
  data: new SlashCommandBuilder() //
    .setName("monitor-start")
    .setDescription("Start monitoring services")
    .setDefaultMemberPermissions(guildAdminsOnlyPermission),
  execute: async function executeSlashMonitorStart(interaction: ChatInputCommandInteraction) {
    setShouldRunOnStart(true);
    await oncePerMinuteState.start();
    await interaction.reply("Active service monitoring has been started");
  },
});

addSlashCommand({
  data: new SlashCommandBuilder() //
    .setName("monitor-stop")
    .setDescription("Stop monitoring services")
    .setDefaultMemberPermissions(guildAdminsOnlyPermission),
  execute: async function executeSlashMonitorStop(interaction: ChatInputCommandInteraction) {
    oncePerMinuteState.stop();
    setShouldRunOnStart(false);
    await interaction.reply("Active service monitoring has been stopped");
  },
});

addSlashCommand({
  data: new SlashCommandBuilder() //
    .setName("monitor-unit-list")
    .setDescription("List systemd units")
    .setDefaultMemberPermissions(guildAdminsOnlyPermission),
  execute: async function executeSlashMonitorUnitAdd(interaction: ChatInputCommandInteraction) {
    const units = getUnits();
    let message = "Units:\n";
    for (const unit of units) {
      message += `\n- **${unit.unitName}**: being checked: ${unit.shouldCheck ? "✅ yes" : "❌ no"}`;
    }
    await interaction.reply(message);
  },
});

addSlashCommand({
  data: new SlashCommandBuilder() //
    .setName("monitor-unit-add")
    .setDescription("Add a new systemd unit and start monitoring it")
    .setDefaultMemberPermissions(guildAdminsOnlyPermission)
    .addStringOption((option) => option.setName("unit-name").setDescription("systemd unit name").setRequired(true)),
  execute: async function executeSlashMonitorUnitAdd(interaction: ChatInputCommandInteraction) {
    const unitName = interaction.options.getString("unit-name")?.trim();
    if (!unitName) {
      await interaction.reply("unit name is required");
      return;
    }
    let problem: string | null = null;
    const currentStatus = (await getSystemdStatuses([unitName])).get(unitName);
    if (currentStatus == null) {
      problem = "The unit is missing from systemd-check-cli output";
    } else if ("error" in currentStatus) {
      problem = `systemd-check-cli returned an error: ${currentStatus.error}`;
    }
    if (problem) {
      await interaction.reply(problem);
      return;
    }
    withTransactionSync(() => {
      createUnit(unitName);
      setMustUpdatePost(true);
    });
    await oncePerMinuteState.runOnce().catch(() => {
      // Error deliberately ignored.
    });
    await interaction.reply(`Added systemd unit ${unitName}`);
  },
});

addSlashCommand({
  data: new SlashCommandBuilder() //
    .setName("monitor-unit-delete")
    .setDescription("Delete a systemd unit")
    .setDefaultMemberPermissions(guildAdminsOnlyPermission)
    .addStringOption((option) => option.setName("unit-name").setDescription("systemd unit name").setRequired(true)),
  execute: async function executeSlashMonitorUnitAdd(interaction: ChatInputCommandInteraction) {
    const unitName = interaction.options.getString("unit-name")?.trim();
    if (!unitName) {
      await interaction.reply("unit name is required");
      return;
    }
    const deleted = withTransactionSync(() => {
      const deleted = deleteUnit(unitName).changes > 0;
      setMustUpdatePost(true);
      return deleted;
    });
    await oncePerMinuteState.runOnce().catch(() => {
      // Error deliberately ignored.
    });
    await interaction.reply(deleted ? `Deleted unit ${unitName}` : `No such unit ${unitName} (maybe already deleted)`);
  },
});

addSlashCommand({
  data: new SlashCommandBuilder() //
    .setName("monitor-unit-start-checking")
    .setDescription("Start checking a systemd unit")
    .setDefaultMemberPermissions(guildAdminsOnlyPermission)
    .addStringOption((option) => option.setName("unit-name").setDescription("systemd unit name").setRequired(true)),
  execute: async function executeSlashMonitorUnitAdd(interaction: ChatInputCommandInteraction) {
    const unitName = interaction.options.getString("unit-name")?.trim();
    if (!unitName) {
      await interaction.reply("unit name is required");
      return;
    }
    const haveUnit = withTransactionSync(() => {
      const unit = setUnitShouldCheck(unitName, true);
      setMustUpdatePost(true);
      return unit != null;
    });
    await oncePerMinuteState.runOnce().catch(() => {
      // Error deliberately ignored.
    });
    await interaction.reply(haveUnit ? `Started checking unit ${unitName}` : `No such unit ${unitName}`);
  },
});

addSlashCommand({
  data: new SlashCommandBuilder() //
    .setName("monitor-unit-stop-checking")
    .setDescription("Stop checking a systemd unit")
    .setDefaultMemberPermissions(guildAdminsOnlyPermission)
    .addStringOption((option) => option.setName("unit-name").setDescription("systemd unit name").setRequired(true)),
  execute: async function executeSlashMonitorUnitAdd(interaction: ChatInputCommandInteraction) {
    const unitName = interaction.options.getString("unit-name")?.trim();
    if (!unitName) {
      await interaction.reply("unit name is required");
      return;
    }
    const haveUnit = withTransactionSync(() => {
      const unit = setUnitShouldCheck(unitName, false);
      setMustUpdatePost(true);
      return unit != null;
    });
    await oncePerMinuteState.runOnce().catch(() => {
      // Error deliberately ignored.
    });
    await interaction.reply(haveUnit ? `Stopped checking unit ${unitName}` : `No such unit ${unitName}`);
  },
});

addSlashCommand({
  data: new SlashCommandBuilder() //
    .setName("monitor-create-new-post")
    .setDescription("Create new monitoring post")
    .setDefaultMemberPermissions(guildAdminsOnlyPermission),
  execute: async function executeSlashMonitorCreateNewPost(interaction: ChatInputCommandInteraction) {
    setMustCreatePost(true);
    await oncePerMinuteState.runOnce(); // Error not ignored!
    await interaction.reply("Created new post");
  },
});
