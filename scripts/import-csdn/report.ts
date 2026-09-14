import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { MigrationReport } from "./types";

export async function writeMigrationReport(
  report: MigrationReport,
  rootDir: string,
  reportPath?: string,
): Promise<string> {
  const filePath = reportPath
    ? path.resolve(rootDir, reportPath)
    : path.join(rootDir, "outputs", "import-report.json");
  const outputDir = path.dirname(filePath);

  await mkdir(outputDir, { recursive: true });
  await writeFile(filePath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  return filePath;
}
