import { bigint2bool, bool2bigint, database, prepareSQL, SQLiteRawRow } from "./mbDatabase.ts";

export type AppSettings = {
  id: 0;
  shouldRunOnStart: boolean;
  myLastPostId: string | null;
  mustUpdatePost: boolean;
  mustCreatePost: boolean;
};

type AppSettingsRaw = SQLiteRawRow<AppSettings>;
function cookAppSettings(raw: AppSettingsRaw): AppSettings {
  return {
    ...raw,
    shouldRunOnStart: bigint2bool(raw.shouldRunOnStart),
    mustUpdatePost: bigint2bool(raw.mustUpdatePost),
    mustCreatePost: bigint2bool(raw.mustCreatePost),
  };
}

const getAppSettingsStatement = prepareSQL(`
  SELECT * FROM AppSettings;
`);
export function getAppSettings(): AppSettings {
  let row = getAppSettingsStatement().get() as AppSettingsRaw | undefined;
  if (row == null) {
    database.exec(`
      INSERT INTO AppSettings(id) VALUES (0)
        ON CONFLICT DO NOTHING;
    `);
    row = getAppSettingsStatement().get() as AppSettingsRaw | undefined;
    if (!row) throw new Error("Failed to create appSettings");
  }
  return cookAppSettings(row);
}

const setShouldRunOnStartStatement = prepareSQL(`
  INSERT INTO AppSettings (id, shouldRunOnStart)
    VALUES(0, :shouldRunOnStart)
    ON CONFLICT DO UPDATE SET shouldRunOnStart=excluded.shouldRunOnStart;
`);
export function setShouldRunOnStart(shouldRunOnStart: boolean) {
  setShouldRunOnStartStatement().run({
    shouldRunOnStart: bool2bigint(shouldRunOnStart),
  });
}

const setMyLastPostIdStatement = prepareSQL(`
  INSERT INTO AppSettings (id, myLastPostId)
    VALUES(0, :myLastPostId)
    ON CONFLICT DO UPDATE SET myLastPostId=excluded.myLastPostId;
`);
export function setMyLastPostId(myLastPostId: string) {
  setMyLastPostIdStatement().run({
    myLastPostId,
  });
}

const setMustUpdatePostStatement = prepareSQL(`
  INSERT INTO AppSettings (id, mustUpdatePost)
    VALUES(0, :mustUpdatePost)
    ON CONFLICT DO UPDATE SET mustUpdatePost=excluded.mustUpdatePost;
`);
export function setMustUpdatePost(mustUpdatePost: boolean) {
  setMustUpdatePostStatement().run({
    mustUpdatePost: bool2bigint(mustUpdatePost),
  });
}

const setMustCreatePostStatement = prepareSQL(`
  INSERT INTO AppSettings (id, mustCreatePost)
    VALUES(0, :mustCreatePost)
    ON CONFLICT DO UPDATE SET mustCreatePost=excluded.mustCreatePost;
`);
export function setMustCreatePost(mustCreatePost: boolean) {
  setMustCreatePostStatement().run({
    mustCreatePost: bool2bigint(mustCreatePost),
  });
}

const clearMustUpdateOrCreatePostStatement = prepareSQL(`
  INSERT INTO AppSettings (id, mustUpdatePost, mustCreatePost)
    VALUES(0, 0, 0)
    ON CONFLICT DO UPDATE SET mustUpdatePost=0, mustCreatePost=0;
`);
export function clearMustUpdateOrCreatePost() {
  return clearMustUpdateOrCreatePostStatement().run({});
}
