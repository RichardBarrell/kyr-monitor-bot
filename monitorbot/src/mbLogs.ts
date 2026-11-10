import fs from "fs";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import chalk from "chalk";
import { textTimestamp } from "./db/mbDatabase.ts";

export enum LogEvent {
  "Success",
  "Warning",
  "Alert",
}

dayjs.extend(utc);
const logFilePath = "./logs/mbLogs.txt";

export function getErrorMessage(error: unknown): string {
  return getErrorMessageIndent(error, "");
}

function getErrorMessageIndent(error: unknown, indent: string): string {
  let message: string;
  if (error instanceof AggregateError) {
    message = `${indent}Multiple errors:`;
    for (const subError of error.errors) {
      const subMessage = getErrorMessageIndent(subError, "  " + indent);
      message += `\n${indent} - ${subMessage.trimStart()}`;
    }
  } else if (error instanceof Error) {
    if (error.stack) {
      message = indent + error.stack.split("\n").join(`\n${indent}`);
    } else message = `${indent}${error.message}`;
  } else {
    message = `${indent}${String(error)}`;
  }
  return message;
}

export function logErrorToFile(functionName: string, error: unknown, warningLevel?: LogEvent) {
  const message = getErrorMessage(error);
  logToFile(`Error in #${functionName}: ${message}`, warningLevel);
}

export function logToFile(logMessage: string, warningLevel?: LogEvent) {
  try {
    const timestamp = textTimestamp();
    const formattedLogMessage = `${timestamp} - ${logMessage}\n`;
    fs.appendFileSync(logFilePath, formattedLogMessage);
  } catch (error) {
    console.error(`Error writing to log file: ${error}`);
  }
  switch (warningLevel) {
    case LogEvent.Success:
      console.log(chalk.green(logMessage));
      break;
    case LogEvent.Warning:
      console.log(chalk.yellow(logMessage));
      break;
    case LogEvent.Alert:
      console.log(chalk.red(logMessage));
      break;
    case undefined:
      console.log(logMessage);
      break;
    default:
      const unreachable: never = warningLevel;
      console.warn("Unknown warningLevel", unreachable);
      console.log(logMessage);
  }
}

export function createLogsDir() {
  fs.mkdirSync("./logs", { recursive: true });
}
