import { logErrorToFile, LogEvent } from "./mbLogs.ts";

const ONE_SECOND = 1000;
class OncePerMinuteState {
  name: string;
  constructor(name: string) {
    this.name = name;
  }
  public callback: () => Promise<void> = async function noop() {};
  promise: Promise<void> | null = null;
  timeout: ReturnType<typeof setTimeout> | null = null;
  shouldKeepRunning = false;

  /**
   * Start calling callback() once per minute.
   * If callback is not already running, it will be run immediately.
   *
   * @returns Promise that resolves/rejects when callback() resolves/rejects
   */
  public start = (): Promise<void> => {
    this.shouldKeepRunning = true;
    if (this.promise) return this.promise;
    return this._runPart1();
  };

  /**
   * Stop calling callback() once per minute.
   * callback won't be interrupted if it is already running.
   */
  public stop() {
    this.shouldKeepRunning = false;
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }
  }

  /**
   * Call callback() once right now, regardless of the timer.
   * If callback is already running, it will be at least one more time after it finishes.
   *
   * @returns Promise that resolves/rejects when callback() resolves/rejects
   */
  public async runOnce() {
    if (this.promise) {
      await this.promise.catch(() => {
        // deliberately ignore any error from the *previous* callback() call
        // because we're interested in errors (if any) from the *next* callback() call
      });
    }
    if (this.promise) return this.promise;
    return this._runPart1();
  }

  private _runPart1() {
    if (this.promise) {
      throw new Error("assert: this.promise should be null when _runPart1 is called");
    }
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }
    this.promise = Promise.resolve().then(this._runPart2);
    return this.promise;
  }

  private _runPart2 = async () => {
    try {
      await this.callback();
    } catch (error) {
      logErrorToFile(this.name, error, LogEvent.Alert);
      throw error;
    } finally {
      this.promise = null;
      if (this.shouldKeepRunning) {
        this.timeout = setTimeout(this.start, 60 * ONE_SECOND);
      }
    }
  };
}

export const oncePerMinuteState = new OncePerMinuteState("monitorOncePerMinute");
