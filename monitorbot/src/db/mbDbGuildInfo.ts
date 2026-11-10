import { prepareSQL } from "./mbDatabase.ts";

export type GuildInfo = {
  id: string;
  slashCommandsHash: string | null;
};

const getGuildInfoStatement = prepareSQL(`
  SELECT * FROM GuildInfo WHERE id=:id;
`);
const createGuildInfoStatement = prepareSQL(`
  INSERT INTO GuildInfo (id) VALUES(:id)
    ON CONFLICT DO NOTHING
    RETURNING *;
`);
export function getGuildInfo(id: string): GuildInfo {
  let guild = getGuildInfoStatement().get({ id }) as GuildInfo | undefined;
  if (guild == null) {
    guild = createGuildInfoStatement().get({ id }) as GuildInfo;
  }
  return guild;
}

const guildInfoSetSlashCommandsHash = prepareSQL(`
  INSERT INTO GuildInfo (id, slashCommandsHash) VALUES(:id, :slashCommandsHash)
    ON CONFLICT DO UPDATE SET slashCommandsHash=excluded.slashCommandsHash
    RETURNING *;
`);
export function setGuildInfoSlashCommandsHash(id: string, slashCommandsHash: string | null) {
  return guildInfoSetSlashCommandsHash().get({ id, slashCommandsHash }) as GuildInfo;
}
