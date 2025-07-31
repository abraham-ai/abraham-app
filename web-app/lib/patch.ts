import DiffMatchPatch from "diff-match-patch";
const dmp = new DiffMatchPatch();

export function buildPatch(
  oldStr: string,
  newStr: string
): { hex: `0x${string}`; changed: number } {
  const diffs = dmp.diff_main(oldStr, newStr);
  dmp.diff_cleanupEfficiency(diffs);

  const out: number[] = [];
  let changed = 0;

  /** push a run, splitting if > 0xFFFF */
  const push = (op: number, n: number) => {
    if (!n) return;
    while (n > 0xffff) {
      push(op, 0xffff);
      n -= 0xffff;
    }
    out.push(op, (n >> 8) & 0xff, n & 0xff);
  };

  for (const [kind, text] of diffs) {
    const n = text.length;
    if (kind === DiffMatchPatch.DIFF_EQUAL) {
      push(0x00, n);
    } else if (kind === DiffMatchPatch.DIFF_DELETE) {
      push(0x01, n);
      changed += n;
    } else if (kind === DiffMatchPatch.DIFF_INSERT) {
      push(0x02, n);
      for (let i = 0; i < n; i++) out.push(text.charCodeAt(i));
      changed += n;
    }
  }

  const hex = ("0x" +
    out.map((b) => b.toString(16).padStart(2, "0")).join("")) as `0x${string}`;

  return { hex, changed };
}
