export interface GroupableTrace {
  number: number;
  origin: string | null;
  location: string | null;
  revelationTechnique: string | null;
}

export interface ExaminedTraceGroup {
  label: string;
  origin: string | null;
  location: string | null;
  revelationTechnique: string | null;
}

export function traceReference(caseNumber: string, number: number): string {
  return `${caseNumber}-T${number}`;
}

function labelOfRun(caseNumber: string, run: GroupableTrace[]): string {
  const first = traceReference(caseNumber, run[0].number);
  if (run.length === 1) {
    return first;
  }
  const last = `T${run[run.length - 1].number}`;
  return run.length === 2 ? `${first} et ${last}` : `${first} à ${last}`;
}

function sameDescription(left: GroupableTrace, right: GroupableTrace): boolean {
  return (
    left.location === right.location &&
    left.origin === right.origin &&
    left.revelationTechnique === right.revelationTechnique
  );
}

export function groupExaminedTraces(
  caseNumber: string,
  traces: GroupableTrace[],
): ExaminedTraceGroup[] {
  const ordered = [...traces].sort((left, right) => left.number - right.number);
  const runs: GroupableTrace[][] = [];

  for (const trace of ordered) {
    const current = runs[runs.length - 1];
    const previous = current?.[current.length - 1];
    if (
      previous &&
      previous.number + 1 === trace.number &&
      sameDescription(previous, trace)
    ) {
      current.push(trace);
      continue;
    }
    runs.push([trace]);
  }

  return runs.map((run) => ({
    label: labelOfRun(caseNumber, run),
    origin: run[0].origin,
    location: run[0].location,
    revelationTechnique: run[0].revelationTechnique,
  }));
}
