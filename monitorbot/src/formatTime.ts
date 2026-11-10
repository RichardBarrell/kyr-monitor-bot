export function formatTimeSeconds(seconds: number) {
  let accumulator = Math.trunc(Math.abs(seconds));
  const unitParts: string[] = [];
  let afterFirstPart = false;
  for (const [name, size, padLength] of timeUnits) {
    const chunk = Math.floor(accumulator / size);
    if (chunk === 0 && !afterFirstPart && size > 1) continue;
    const paddedChunk = String(chunk).padStart(afterFirstPart ? padLength : 1, "0");
    unitParts.push(`${paddedChunk}${name}`);
    accumulator -= chunk * size;
    afterFirstPart = true;
  }
  const output = unitParts.join(" ");
  return Math.trunc(seconds) < 0 ? `minus ${output}` : output;
}

const timeUnits = [
  ["d", 86400, 1],
  ["h", 3600, 2],
  ["m", 60, 2],
  ["s", 1, 2],
] as const;
