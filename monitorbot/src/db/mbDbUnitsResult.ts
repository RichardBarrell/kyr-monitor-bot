import { SystemdUnitName, SystemdUnitResult } from "../mbSystemdUnitStatus.ts";
import { prepareSQL, textTimestamp, withTransactionSync } from "./mbDatabase.ts";
import { getOrCreateUnit } from "./mbDbUnit.ts";

export type UnitResultRow = { createdAt: string } & SystemdUnitResult;

type UnitResultRowRaw = {
  createdAt: string;
  activeState: string | null;
  subState: string | null;
  activeTime: bigint | null;
  error: string | null;
};
function cookUnitResultRow(raw: UnitResultRowRaw): UnitResultRow {
  if (raw.error != null) {
    return {
      createdAt: raw.createdAt,
      error: raw.error,
    };
  } else if (raw.activeState != null && raw.subState != null) {
    return {
      createdAt: raw.createdAt,
      activeState: raw.activeState,
      subState: raw.activeState,
      activeTime: raw.activeTime != null ? Number(raw.activeTime) : undefined,
    };
  }
  throw new Error(`invalid UnitResult row: ${JSON.stringify(raw)}`);
}

const insertResultForUnit = prepareSQL(`
  INSERT INTO UnitResult (unitId, createdAt, activeState, subState, activeTime, error)
    VALUES (:unitId, :createdAt, :activeState, :subState, :activeTime, :error)
    ON CONFLICT DO UPDATE SET createdAt=:createdAt, activeState=:activeState, subState=:subState, activeTime=:activeTime, error=:error;
`);

export function saveResultsForUnits(unitStatuses: Iterable<[SystemdUnitName, SystemdUnitResult]>) {
  const createdAt = textTimestamp();
  withTransactionSync(() => {
    for (const [unitName, status] of unitStatuses) {
      const unitId = getOrCreateUnit(unitName).id;
      if ("error" in status) {
        const { error } = status;
        insertResultForUnit().run({
          unitId,
          createdAt,
          activeState: null,
          subState: null,
          activeTime: null,
          error,
        });
      } else {
        const { activeState, subState, activeTime } = status;
        insertResultForUnit().run({
          unitId,
          createdAt,
          activeState,
          subState,
          activeTime: activeTime ?? null,
          error: null,
        });
      }
    }
  });
}

const getLastResultForUnitSelect = prepareSQL(`
  SELECT UnitResult.createdAt, UnitResult.activeState, UnitResult.subState, UnitResult.activeTime, UnitResult.error
    FROM Unit JOIN UnitResult ON Unit.id = UnitResult.unitId
    WHERE Unit.unitName = :unitName;
`);

export function getLastResultForUnit(unitName: SystemdUnitName) {
  const row = getLastResultForUnitSelect().get({ unitName });
  return row && cookUnitResultRow(row as UnitResultRowRaw);
}
