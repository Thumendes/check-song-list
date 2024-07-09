// Create a logger abstraction that logs the date with colors using chalk: It must have a log, info, warn and error methods

import chalk from "chalk";

export class Logger {
  private prefixes: string[];

  constructor(init: string | { prefixes?: string[] }) {
    if (typeof init === "string") {
      this.prefixes = [init];
    } else {
      this.prefixes = init.prefixes ?? [];
    }
  }

  withPrefix(prefix: string) {
    return new Logger({ prefixes: [...this.prefixes, prefix] });
  }

  log(message: string, ...args: any[]) {
    this._log(chalk.blue(message), ...args);
  }

  success(message: string, ...args: any[]) {
    this._log(chalk.green(message), ...args);
  }

  info(message: string, ...args: any[]) {
    this._log(chalk.cyan(message), ...args);
  }

  warn(message: string, ...args: any[]) {
    this._log(chalk.yellow(message), ...args);
  }

  error(message: string, ...args: any[]) {
    this._log(chalk.red(message), ...args);
  }

  private _log(...args: any[]) {
    const date = chalk.gray(new Date().toISOString());
    const prefixes = this.prefixes.map((prefix) => `[${chalk.gray.bold(prefix)}]`);

    return console.log(`[${date}]${prefixes.length ? ` ${prefixes.join(" ")}` : ""}`, ...args);
  }
}
