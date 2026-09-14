import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { writeMigrationReport } from "../../scripts/import-csdn/report";
import type { MigrationReport } from "../../scripts/import-csdn/types";

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) =>
      rm(root, { recursive: true, force: true }),
    ),
  );
});

async function makeRoot(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "csdn-report-"));
  temporaryRoots.push(root);
  return root;
}

const report: MigrationReport = {
  startedAt: "2026-09-07T00:00:00.000Z",
  finishedAt: "2026-09-07T00:01:00.000Z",
  discovered: 2,
  written: 1,
  skipped: 0,
  failures: [],
  assets: [],
};

describe("writeMigrationReport", () => {
  test("默认写入 outputs/import-report.json 且内容确定", async () => {
    const root = await makeRoot();
    const writtenPath = await writeMigrationReport(report, root);

    expect(writtenPath).toBe(path.join(root, "outputs", "import-report.json"));

    const content = await readFile(writtenPath, "utf8");
    expect(JSON.parse(content)).toEqual(report);
  });
});
