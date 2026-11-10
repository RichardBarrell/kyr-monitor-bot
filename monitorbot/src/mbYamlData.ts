import fs from "fs/promises";
import yaml from "yaml";
import * as z from "zod";

const yamlFile = "data/data.yml";

const yamlSchema = z.strictObject({
  botChannelId: z.string(),
  guildId: z.string(),
  defaultUnits: z.array(z.string()),
});

export type YamlData = z.infer<typeof yamlSchema>;

async function loadYaml(): Promise<YamlData> {
  const data = await fs.readFile(yamlFile, "utf8");
  return yaml.parse(data) as YamlData;
}

let yamlDataPromise: Promise<YamlData> | null = null;
export function getYamlData(): Promise<YamlData> {
  if (yamlDataPromise == null) {
    yamlDataPromise = loadYaml();
  }
  return yamlDataPromise;
}
