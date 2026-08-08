import { AutoroutingPipelineSolver } from "@tscircuit/capacity-autorouter"
import { getSvgFromGraphicsObject } from "graphics-debug"
import { useMemo } from "react"
import sample from "../circuits/circuit001.circuit.srj.json"

export default function SampleFixture() {
  const svg = useMemo(() => {
    const solver = new AutoroutingPipelineSolver(structuredClone(sample))
    return getSvgFromGraphicsObject(solver.visualize(), {
      backgroundColor: "#ffffff",
      svgWidth: 1200,
      svgHeight: 800,
    })
  }, [])

  return (
    <main style={{ fontFamily: "system-ui", padding: 24 }}>
      <h1>SRJ28 · Partially pre-routed circuit001</h1>
      <p>
        {sample.obstacles.length} obstacles · {sample.connections.length}{" "}
        connections · {sample.traces.length} retained traces
      </p>
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: This SVG is generated locally from checked-in SRJ data. */}
      <div dangerouslySetInnerHTML={{ __html: svg }} />
    </main>
  )
}
