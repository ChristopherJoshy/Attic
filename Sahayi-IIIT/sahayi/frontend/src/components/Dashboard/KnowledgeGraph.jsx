import { memo, useDeferredValue, useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import { Info, Maximize2 } from "lucide-react";

function KnowledgeGraph({ graph }) {
  const svgRef = useRef(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const deferredGraph = useDeferredValue(graph);

  useEffect(() => {
    if (!deferredGraph?.nodes?.length || !svgRef.current) {
      return undefined;
    }
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    
    // Adjusted dimensions for modern card
    const width = 600;
    const height = 400;

    const simulation = d3.forceSimulation(deferredGraph.nodes)
      .force("link", d3.forceLink(deferredGraph.edges).id((d) => d.id).distance(100))
      .force("charge", d3.forceManyBody().strength(-250))
      .force("center", d3.forceCenter(width / 2, height / 2));

    const link = svg.append("g")
      .selectAll("line")
      .data(deferredGraph.edges)
      .join("line")
      .attr("stroke", "#e2e8f0")
      .attr("stroke-width", (d) => (d.weight || 0.5) * 4);

    const node = svg.append("g")
      .selectAll("circle")
      .data(deferredGraph.nodes)
      .join("circle")
      .attr("r", 12)
      .attr("fill", (d) => colorByType(d.type))
      .attr("stroke", "#fff")
      .attr("stroke-width", 3)
      .style("cursor", "pointer")
      .style("filter", "drop-shadow(0 4px 3px rgb(0 0 0 / 0.07))")
      .on("click", (_, datum) => setSelectedNode(datum));

    const text = svg.append("g")
      .selectAll("text")
      .data(deferredGraph.nodes)
      .join("text")
      .attr("fill", "#334155")
      .attr("font-size", 10)
      .attr("font-weight", "700")
      .attr("font-family", "sans-serif")
      .text((d) => d.label.toUpperCase());

    simulation.on("tick", () => {
      link.attr("x1", (d) => d.source.x)
          .attr("y1", (d) => d.source.y)
          .attr("x2", (d) => d.target.x)
          .attr("y2", (d) => d.target.y);

      node.attr("cx", (d) => d.x)
          .attr("cy", (d) => d.y);

      text.attr("x", (d) => d.x + 16)
          .attr("y", (d) => d.y + 4);
    });

    return () => simulation.stop();
  }, [deferredGraph?.version]);

  return (
    <section className="p-4">
      <div className="relative mb-4">
        <svg 
          ref={svgRef} 
          viewBox="0 0 600 400" 
          className="h-96 w-full rounded-2xl bg-slate-50 border border-slate-100" 
        />
        
        {/* Floating Controls */}
        <div className="absolute right-4 top-4 flex flex-col gap-2">
           <button className="rounded-xl bg-white p-2 text-slate-400 shadow-sm border border-slate-100 hover:text-sahayi-primary transition-colors">
             <Maximize2 size={18} />
           </button>
        </div>
      </div>

      <div className="flex items-center gap-3 rounded-2xl bg-slate-50 border border-slate-100 p-4 transition-all">
        <div className="rounded-full bg-sahayi-primary/10 p-2 text-sahayi-primary shrink-0">
          <Info size={18} />
        </div>
        <div className="flex-1">
          <p className="text-xs font-bold text-slate-700">
            {selectedNode ? (
              <span className="flex items-center gap-2">
                SELECTED: <span className="text-sahayi-primary uppercase">{selectedNode.label}</span>
                <span className="h-1 w-1 rounded-full bg-slate-300" />
                TYPE: <span className="text-slate-400 uppercase">{selectedNode.type}</span>
              </span>
            ) : "Click on a medical node to explore clinical evidence connections."}
          </p>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-6 flex flex-wrap gap-4 px-2">
        {['symptom', 'condition', 'evidence', 'recommendation'].map(type => (
          <div key={type} className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: colorByType(type) }} />
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-tighter">{type}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function colorByType(type) {
  return { 
    symptom: "#3b82f6", 
    condition: "#f59e0b", 
    evidence: "#10b981", 
    recommendation: "#8b5cf6" 
  }[type] || "#94a3b8";
}

export default memo(KnowledgeGraph);
