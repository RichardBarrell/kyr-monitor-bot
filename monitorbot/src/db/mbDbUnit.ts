import { SystemdUnitName } from "../mbSystemdUnitStatus.ts";
import { bigint2bool, bool2bigint, prepareSQL, SQLiteRawRow, textTimestamp } from "./mbDatabase.ts";

export type UnitRow = {
  id: bigint;
  unitName: SystemdUnitName;
  createdAt: string;
  shouldCheck: boolean;
};

type UnitRowRaw = SQLiteRawRow<UnitRow>;
function cookUnitRow(raw: UnitRowRaw): UnitRow {
  return {
    ...raw,
    shouldCheck: bigint2bool(raw.shouldCheck),
  };
}

const createUnitStatement = prepareSQL(`
  INSERT INTO Unit(unitName, createdAt, shouldCheck)
    VALUES(:unitName, :createdAt, 1)
    ON CONFLICT DO NOTHING;
`);
export function createUnit(unitName: SystemdUnitName): UnitRow {
  const createdAt = textTimestamp();
  createUnitStatement().run({ unitName, createdAt });
  const unit = getUnit(unitName);
  if (!unit) throw new Error("Just-created Unit does not exist");
  return unit;
}

export function getOrCreateUnit(unitName: SystemdUnitName): UnitRow {
  let unit = getUnit(unitName);
  if (!unit) unit = createUnit(unitName);
  return unit;
}

const deleteUnitStatement = prepareSQL("DELETE FROM Unit WHERE unitName=:unitName;");
export function deleteUnit(unitName: SystemdUnitName) {
  return deleteUnitStatement().run({ unitName });
}

const getUnitsStatement = prepareSQL("SELECT * FROM Unit;");
export function getUnits(): UnitRow[] {
  return getUnitsStatement()
    .all()
    .map((x) => cookUnitRow(x as UnitRowRaw));
}

const getUnitsToCheckStatement = prepareSQL("SELECT * FROM Unit WHERE shouldCheck=1;");
export function getUnitsToCheck(): UnitRow[] {
  return getUnitsToCheckStatement()
    .all()
    .map((x) => cookUnitRow(x as UnitRowRaw));
}

const getUnitStatement = prepareSQL(`
  SELECT * FROM Unit WHERE unitName = :unitName;
`);
export function getUnit(unitName: SystemdUnitName): UnitRow | undefined {
  const unit = getUnitStatement().get({ unitName }) as UnitRowRaw | undefined;
  return unit && cookUnitRow(unit);
}

const setUnitShouldCheckStatement = prepareSQL(`
  UPDATE Unit SET shouldCheck=:shouldCheck
    WHERE unitName=:unitName
    RETURNING *;
`);
export function setUnitShouldCheck(unitName: SystemdUnitName, shouldCheck: boolean) {
  const unit = setUnitShouldCheckStatement().get({ unitName, shouldCheck: bool2bigint(shouldCheck) }) as
    | UnitRowRaw
    | undefined;
  return unit && cookUnitRow(unit);
}
