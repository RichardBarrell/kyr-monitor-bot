import { execFile as rawExecFile } from "child_process";
import { promisify } from "util";
import * as z from "zod";

const execFile = promisify(rawExecFile);

type SystemdUnitError = {
  error: string;
};
type SystemdUnitStatus = {
  activeState: string; // usually "active" or "inactive"
  subState: string; // usually "running" or "dead"
  activeTime?: number; // in seconds, not milliseconds!
};
export type SystemdUnitResult = SystemdUnitError | SystemdUnitStatus;

export type SystemdUnitName = string;
const ONE_SECOND = 1000;
const responseSchema = z.object().catchall(
  z.union([
    // good response
    z.object({
      activeState: z.string(),
      subState: z.string(),
      activeTime: z.number().optional(),
    }),
    // error repsonse
    z.object({
      error: z.string(),
    }),
  ]),
);

export async function getSystemdStatuses(unitNames: readonly string[]) {
  const abortController = new AbortController();
  const timeout = setTimeout(() => {
    abortController.abort();
  }, 5 * ONE_SECOND);
  let stdout: string;
  const { runViaSshOnHost, systemdCheckCliCommand = "/opt/kyr/bin/systemd-check-cli" } = process.env;
  if (runViaSshOnHost) {
    stdout = (
      await execFile("ssh", [runViaSshOnHost, systemdCheckCliCommand, ...unitNames], {
        signal: abortController.signal,
      })
    ).stdout;
  } else {
    stdout = (
      await execFile(systemdCheckCliCommand, unitNames, {
        signal: abortController.signal,
      })
    ).stdout;
  }
  clearTimeout(timeout);
  const responseJson = JSON.parse(stdout);
  const response = responseSchema.parse(responseJson);
  return new Map<SystemdUnitName, SystemdUnitResult>(Object.entries(response));
}
