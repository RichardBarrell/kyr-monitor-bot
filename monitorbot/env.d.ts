declare namespace NodeJS {
  interface ProcessEnv {
    sshKeyPath: string;
    discordToken: string;
    DatabaseUrl: string;
    runViaSshOnHost?: string;
    systemdCheckCliCommand?: string;
  }
}
