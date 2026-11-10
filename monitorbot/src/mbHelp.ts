import { SendableChannel } from "./mbTypes.js";

export async function replyWithAdminHelp(channel: SendableChannel) {
  await channel.send(adminHelp);
}

const adminHelp = `
**Help Menu**
My Commands are as follows:

- \`/monitor-start\` - Start monitoring
- \`/monitor-stop\` - Stop monitoring
  `.trim();
