import "../src/mbLoadEnv.ts";
import { buildTar, type TarBuildOptions } from "kyrutils";
import { NodeSSH } from "node-ssh";
import chalk from "chalk";
import fs from "fs/promises";

const buildTarOptions: TarBuildOptions = {
  overrideEnv: false,
  dataDir: `./data`,
};

async function connectToServer(): Promise<NodeSSH> {
  console.log("Connecting to server");
  const ssh = new NodeSSH();
  const connection = await ssh.connect({
    host: `148.251.46.39`,
    port: 22,
    username: `monitorbot`,
    privateKey: await fs.readFile(process.env.sshKeyPath, `utf-8`),
  });
  console.log(`Connected to Server`);
  return connection;
}

async function cleanUp(): Promise<void> {
  await Promise.all([
    await fs.unlink(`project.tar`),
    await fs.unlink(`project.tar.zst`),
    await fs.rm(`sudoTarZst`, { recursive: true, force: true }),
  ]);
  console.log(`Cleanup complete`);
}

async function cleanServerFiles(connection: NodeSSH): Promise<void> {
  await connection.execCommand(`rm deployCm.js`);
}

async function unzipProjectArchive(connection: NodeSSH): Promise<void> {
  await connection.execCommand(`tar --zstd -xvf project.tar.zst`);
  console.log(`Archive extracted`);
}

async function uploadProjectArchive(connection: NodeSSH): Promise<void> {
  await connection.putFile(`project.tar.zst`, `project.tar.zst`);
  console.log(`Archive uploaded`);
}

async function constructProjectArchive(): Promise<void> {
  await Promise.all([
    fs.cp(`./pnpm-lock.yaml`, `./dist/pnpm-lock.yaml`),
    fs.cp(`./pnpm-workspace.yaml`, `./dist/pnpm-workspace.yaml`),
  ]);
  await buildTar(buildTarOptions);
  console.log(`Archive built`);
}

async function main() {
  let connection: NodeSSH | undefined;
  try {
    await constructProjectArchive();
    connection = await connectToServer();
    await uploadProjectArchive(connection);
    await unzipProjectArchive(connection);
    await cleanServerFiles(connection);
  } finally {
    connection?.dispose();
  }
  await cleanUp();
}

try {
  await main();
  console.log(chalk.green(`Project upload, unpack and cleanup completed successfully`));
} catch (error) {
  console.log(chalk.red(`Error in upload script: ${error instanceof Error ? error.stack || error.message : error}`));
}
