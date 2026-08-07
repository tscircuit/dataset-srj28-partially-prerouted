import { expect, test } from "bun:test"
import * as sourceDataset from "@tscircuit/autorouting-dataset-01"
import * as dataset from "../index.js"
import manifest from "../manifest.json"

const circuitNamePattern = /^circuit\d+$/

test("exports every dataset01 circuit with exactly half of solved traces removed", () => {
  const sourceNames = Object.keys(sourceDataset)
    .filter((name) => circuitNamePattern.test(name))
    .sort()
  const datasetNames = Object.keys(dataset)
    .filter((name) => circuitNamePattern.test(name))
    .sort()

  expect(datasetNames).toEqual(sourceNames)
  expect(datasetNames.length).toBeGreaterThan(0)

  for (const circuitName of datasetNames) {
    const sample = dataset[circuitName as keyof typeof dataset]
    const record =
      manifest.circuits[circuitName as keyof typeof manifest.circuits]
    expect(sample.traces?.length ?? 0).toBe(record.retainedTraceCount)
    expect(record.removedTraceCount).toBe(
      Math.floor(record.solvedTraceCount * 0.5),
    )
    expect(record.retainedTraceCount + record.removedTraceCount).toBe(
      record.solvedTraceCount,
    )
  }
})
