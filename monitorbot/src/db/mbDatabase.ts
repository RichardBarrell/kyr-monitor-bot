import { DatabaseSync, StatementSync } from "node:sqlite";
import "../mbLoadEnv.ts";
import dayjs from "dayjs";
import { LogEvent, logToFile } from "../mbLogs.ts";

const url = process.env.DatabaseUrl;
export const database = new DatabaseSync(url, { open: false });

type Migration = {
  id: number;
  name: string;
  sql: string;
};

export function initDatabase() {
  console.log("init database");
  database.open();

  database.exec(`
  CREATE TABLE IF NOT EXISTS migration (
    id INTEGER,
    name TEXT,
    date TEXT
  ) STRICT;
  `);
  logToFile("Opened database");

  const migrations: Migration[] = [
    {
      id: 0,
      name: "original",
      sql: `
  CREATE TABLE AppSettings (
    id INTEGER PRIMARY KEY CHECK(id=0),
    shouldRunOnStart INTEGER NOT NULL
      CHECK(shouldRunOnStart=0 OR shouldRunOnStart=1)
      DEFAULT (1),
    myLastPostId TEXT NULL
  ) STRICT;
  CREATE TABLE GuildInfo (
    id TEXT PRIMARY KEY,
    slashCommandsHash TEXT NULL
  ) STRICT;
  CREATE TABLE UnitResult (
    unitName TEXT PRIMARY KEY,
    createdAt TEXT NOT NULL,
    activeState TEXT NOT NULL,
    subState TEXT NOT NULL,
    activeTime INTEGER NULL
  ) STRICT;
`,
    },
    {
      id: 1,
      name: "units_in_database",
      sql: `
  ALTER TABLE AppSettings
    ADD COLUMN mustUpdatePost INTEGER NOT NULL
      CHECK(mustUpdatePost=0 OR mustUpdatePost=1)
      DEFAULT (0);
  ALTER TABLE AppSettings
    ADD COLUMN mustCreatePost INTEGER NOT NULL
      CHECK(mustCreatePost=0 OR mustCreatePost=1)
      DEFAULT (0);
  ALTER TABLE UnitResult RENAME TO OldUR;

  CREATE TABLE Unit (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    unitName TEXT NOT NULL UNIQUE,
    createdAt TEXT NOT NULL,
    checkedLastTime INTEGER NOT NULL
      CHECK(checkedLastTime=0 OR checkedLastTime=1)
      DEFAULT(0),
    shouldCheck INTEGER NOT NULL
      CHECK(shouldCheck=0 OR shouldCheck=1)
      DEFAULT(1)
  ) STRICT;
  CREATE TABLE UnitResult (
    unitId INTEGER PRIMARY KEY,
    createdAt TEXT NOT NULL,
    activeState TEXT NULL,
    subState TEXT NULL,
    activeTime INTEGER NULL,
    error TEXT NULL,
    CONSTRAINT UnitResult_errorOrState CHECK (
      (
        error IS NULL AND
        activeState IS NOT NULL AND
        subState IS NOT NULL
      ) OR (
        error IS NOT NULL AND
        activeState IS NULL AND
        subState IS NULL AND
        activeTime IS NULL
      )
    ),
    CONSTRAINT UnitResult_fk
      FOREIGN KEY (unitId) REFERENCES Unit(id)
      ON DELETE CASCADE
  );

  INSERT INTO Unit (unitName, createdAt)
    SELECT unitName, createdAt FROM OldUR;
  INSERT INTO UnitResult (unitId, createdAt, activeState, subState, activeTime)
    SELECT Unit.id, OldUR.createdAt, activeState, subState, activeTime
      FROM OldUR JOIN Unit ON OldUR.unitName = Unit.unitName;
  DROP TABLE OldUR;
`,
    },
  ];
  const checkStatement = database.prepare("SELECT id FROM migration WHERE id = :id;");
  const addStatement = database.prepare("INSERT INTO migration (id, name, date) VALUES (:id, :name, :date);");

  for (const migration of migrations) {
    let shouldRun = false;
    database.exec("BEGIN TRANSACTION;");
    try {
      shouldRun = checkStatement.get({ id: migration.id }) == null;
      if (shouldRun) {
        database.exec(migration.sql);
        addStatement.run({ id: migration.id, name: migration.name, date: textTimestamp() });
      }
    } catch (error) {
      database.exec("ROLLBACK TRANSACTION;");
      throw error;
    }
    database.exec("COMMIT TRANSACTION;");
    if (shouldRun) {
      logToFile(`Ran migration ${migration.id} (${migration.name})`, LogEvent.Success);
    }
  }
}

export const textTimestamp = (n?: number): string => dayjs.utc(n).format("YYYY-MM-DD HH:mm:ss");

/**
 * Prepares a SQL statement.
 * (Returns an 0-argument function to delay actually preparing the statement.)
 *
 * @example
 * type FooRow = { name: string; }
 * const createFooStatement = prepareSQL("INSERT INTO foo(name) VALUES (:name) RETURNING *;");
 * function createFooStatement(name: string) {
 *   return createFooStatement().get({ name }) as FooRow;
 * }
 *
 * @param sql static string containing SQL
 * @param customise callback for mustating the statement (e.g. you can change s.setReadBigInts())
 * @returns a function, which returns a StatementSync
 */
export function prepareSQL(sql: string, customise?: (statement: StatementSync) => void): () => StatementSync {
  let statement: StatementSync | null = null;
  return () => {
    if (statement == null) {
      statement = database.prepare(sql);
      statement.setReadBigInts(true);
      if (customise) customise(statement);
    }
    return statement;
  };
}

/**
 * Runs action() in a database transaction. Rolls back if action throws an error.
 *
 * @param action Code to run. Should usually execute some SQL statements. Must be sync!
 * @returns value returned from action().
 */
export function withTransactionSync<T>(action: () => T): T {
  let result: T;
  database.exec("BEGIN TRANSACTION;");
  try {
    result = action();
    database.exec("COMMIT TRANSACTION;");
  } catch (error) {
    database.exec("ROLLBACK TRANSACTION;");
    throw error;
  }
  return result;
}

export const bool2bigint = (x: boolean) => (x ? 1n : 0n);
export const bigint2bool = (x: 0n | 1n) => Boolean(x);

/**
 * Replaces booleans in object with (0n | 1n).
 * Because SQLite doesn't have a boolean type.
 */
export type SQLiteRawRow<Row> = {
  [k in keyof Row]: Row[k] extends boolean ? 0n | 1n : Row[k];
};
