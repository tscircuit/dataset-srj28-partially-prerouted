import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import * as sourceDataset from "@tscircuit/autorouting-dataset-01"
import {
  AutoroutingPipelineSolver7_MultiGraph,
  type SimpleRouteJson,
  type SimplifiedPcbTrace,
} from "@tscircuit/capacity-autorouter"

type DatasetModule = Record<string, unknown>
type CircuitManifest = {
  sourceConnectionCount: number
  solvedTraceCount: number
  removedTraceCount: number
  retainedTraceCount: number
}

const sourceRevision = "52c45500b04d0380aa2a1be9b4c6f32d9b138553"
const selectionSeed = "dataset-srj28-partially-prerouted-v1"
const circuitNamePattern = /^circuit\d+$/
const outputDirectory = path.resolve("circuits")

const createSeed = (value: string): number => {
  let hash = 0x811c9dc5
  for (const character of value) {
    hash ^= character.codePointAt(0) ?? 0
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

const createPseudoRandom = (initialSeed: number): (() => number) => {
  let seed = initialSeed
  return () => {
    seed += 0x6d2b79f5
    let value = seed
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296
  }
}

const getPseudoRandomTraceIndexes = (
  circuitName: string,
  traceCount: number,
): number[] => {
  const indexes = Array.from({ length: traceCount }, (_, index) => index)
  const random = createPseudoRandom(
    createSeed(`${selectionSeed}:${circuitName}`),
  )

  for (let index = indexes.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1))
    ;[indexes[index], indexes[swapIndex]] = [indexes[swapIndex], indexes[index]]
  }
  return indexes
}

const solveWithPipeline7 = (source: SimpleRouteJson): SimpleRouteJson => {
  const solver = new AutoroutingPipelineSolver7_MultiGraph(
    structuredClone(source),
  )
  solver.solve()
  if (solver.failed || !solver.solved) {
    throw new Error(solver.error ?? "Pipeline 7 did not solve the circuit")
  }
  return solver.getOutputSimpleRouteJson()
}

const removeHalfOfTraces = (
  circuitName: string,
  solved: SimpleRouteJson,
): { sample: SimpleRouteJson; removedTraceCount: number } => {
  const traces = solved.traces ?? []
  const removedTraceCount = Math.floor(traces.length * 0.5)
  const removedIndexes = new Set(
    getPseudoRandomTraceIndexes(circuitName, traces.length).slice(
      0,
      removedTraceCount,
    ),
  )
  const retainedTraces = traces.filter(
    (_trace: SimplifiedPcbTrace, index: number) => !removedIndexes.has(index),
  )
  return { sample: { ...solved, traces: retainedTraces }, removedTraceCount }
}

const getSourceCircuits = (): Array<[string, SimpleRouteJson]> =>
  Object.entries(sourceDataset as DatasetModule)
    .filter(([name]) => circuitNamePattern.test(name))
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, value]) => [name, value as SimpleRouteJson])

const writePackageExports = async (circuitNames: string[]): Promise<void> => {
  const js = circuitNames
    .map(
      (name) =>
        `export { default as ${name} } from "./circuits/${name}.circuit.srj.json" with { type: "json" }`,
    )
    .join("\n")
  const declarations = [
    'import type { SimpleRouteJson } from "@tscircuit/capacity-autorouter"',
    "",
    ...circuitNames.map((name) => `export const ${name}: SimpleRouteJson`),
  ].join("\n")
  await Promise.all([
    writeFile(path.resolve("index.js"), `${js}\n`),
    writeFile(path.resolve("index.d.ts"), `${declarations}\n`),
  ])
}

const main = async (): Promise<void> => {
  const sourceCircuits = getSourceCircuits()
  if (sourceCircuits.length === 0) throw new Error("dataset01 has no circuits")

  await rm(outputDirectory, { recursive: true, force: true })
  await mkdir(outputDirectory, { recursive: true })
  const circuits: Record<string, CircuitManifest> = {}

  for (const [circuitName, source] of sourceCircuits) {
    const solved = solveWithPipeline7(source)
    const { sample, removedTraceCount } = removeHalfOfTraces(
      circuitName,
      solved,
    )
    const solvedTraceCount = solved.traces?.length ?? 0
    const retainedTraceCount = sample.traces?.length ?? 0
    circuits[circuitName] = {
      sourceConnectionCount: source.connections.length,
      solvedTraceCount,
      removedTraceCount,
      retainedTraceCount,
    }
    await writeFile(
      path.join(outputDirectory, `${circuitName}.circuit.srj.json`),
      `${JSON.stringify(sample, null, 2)}\n`,
    )
    console.log(
      `${circuitName}: solved ${solvedTraceCount}, removed ${removedTraceCount}, retained ${retainedTraceCount}`,
    )
  }

  const packageJson = JSON.parse(await readFile("package.json", "utf8"))
  const manifest = {
    dataset: "dataset-srj28-partially-prerouted",
    source: {
      dataset: "@tscircuit/autorouting-dataset-01",
      revision: sourceRevision,
    },
    solver: {
      package: "@tscircuit/capacity-autorouter",
      version: packageJson.devDependencies["@tscircuit/capacity-autorouter"],
      pipeline: "AutoroutingPipelineSolver7_MultiGraph",
    },
    traceSelection: {
      algorithm: "FNV-1a seeded Mulberry32 Fisher-Yates shuffle",
      seed: selectionSeed,
      removalFraction: 0.5,
      rounding: "floor",
    },
    circuits,
  }
  await Promise.all([
    writeFile("manifest.json", `${JSON.stringify(manifest, null, 2)}\n`),
    writePackageExports(sourceCircuits.map(([name]) => name)),
  ])
}

await main()
