import { readdir, readFile } from "node:fs/promises"
import * as dataset from "../index.js"
import manifest from "../manifest.json"

const circuitNamePattern = /^circuit\d+$/

const main = async (): Promise<void> => {
  const exportNames = Object.keys(dataset).filter((name) =>
    circuitNamePattern.test(name),
  )
  const manifestNames = Object.keys(manifest.circuits)
  const fileNames = (await readdir("circuits"))
    .filter((name) => name.endsWith(".circuit.srj.json"))
    .map((name) => name.replace(".circuit.srj.json", ""))
    .sort()

  if (
    JSON.stringify(exportNames.sort()) !== JSON.stringify(manifestNames.sort())
  ) {
    throw new Error("index.js and manifest.json circuit names differ")
  }
  if (JSON.stringify(exportNames.sort()) !== JSON.stringify(fileNames)) {
    throw new Error("index.js and circuits directory circuit names differ")
  }

  for (const circuitName of exportNames) {
    const sample = dataset[circuitName as keyof typeof dataset]
    const record =
      manifest.circuits[circuitName as keyof typeof manifest.circuits]
    const retainedTraceCount = sample.traces?.length ?? 0
    if (retainedTraceCount !== record.retainedTraceCount) {
      throw new Error(
        `${circuitName} retained trace count differs from manifest`,
      )
    }
    if (
      record.removedTraceCount !== Math.floor(record.solvedTraceCount * 0.5)
    ) {
      throw new Error(
        `${circuitName} did not remove floor(50%) of solved traces`,
      )
    }
    const serialized = await readFile(
      `circuits/${circuitName}.circuit.srj.json`,
      "utf8",
    )
    if (!serialized.endsWith("\n")) {
      throw new Error(`${circuitName} JSON must end with a newline`)
    }
  }

  console.log(`Validated ${exportNames.length} partially pre-routed circuits`)
}

await main()
