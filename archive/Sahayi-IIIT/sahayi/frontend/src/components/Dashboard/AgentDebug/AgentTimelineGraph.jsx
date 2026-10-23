import { useEffect, useRef } from "react";
import * as d3 from "d3";

export default function AgentTimelineGraph({ events, patients = [] }) {
  const svgRef = useRef(null);

  useEffect(() => {
    if (!events || events.length === 0 || !svgRef.current) return;

    const getPatientName = (patientId) => {
      if (!patientId) return "System";
      const patient = patients.find(p => p.id === patientId || p.patient_id === patientId);
      return patient ? patient.name : `Patient ${patientId.substring(0, 8)}`;
    };

    // Define our 5 superheroes
    const agents = [
      { id: "talker", name: "🗣️ The Talker" },
      { id: "note_taker", name: "📝 Note-Taker" },
      { id: "safety", name: "🛡️ Safety Guard" },
      { id: "messenger", name: "👨‍⚕️ Messenger" },
      { id: "spotter", name: "🔭 Spotter" },
    ];

    // Map websocket events to specific agents
    const mappedEvents = events.map((event) => {
      let agentId = "";
      if (event.event === "call_started" || event.event === "call_ended") agentId = "talker";
      else if (event.event === "new_signal") agentId = "note_taker";
      else if (event.event === "safety_check" || event.event === "doctor_summary") agentId = "safety"; // Use summary as proxy for safety check if missing
      else if (event.event === "doctor_summary") agentId = "messenger";
      else if (event.event === "risk_update" || event.event === "hypothesis_generated") agentId = "spotter";
      else return null;

      const patientId = event.payload?.patient_id || event.payload?.id;

      return {
        ...event,
        agentId,
        patientName: getPatientName(patientId),
        time: new Date(event.occurred_at || new Date().toISOString()),
      };
    }).filter(Boolean);

    // D3 Setup
    const margin = { top: 20, right: 20, bottom: 30, left: 120 };
    const width = svgRef.current.parentElement.clientWidth - margin.left - margin.right;
    const height = 250 - margin.top - margin.bottom;

    // Clear previous graph
    d3.select(svgRef.current).selectAll("*").remove();

    const svg = d3.select(svgRef.current)
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // X Scale (Time)
    const timeExtent = d3.extent(mappedEvents, d => d.time);
    
    // If we only have 1 event, pad the time scale so it doesn't break
    if (timeExtent[0] && timeExtent[0].getTime() === timeExtent[1].getTime()) {
      timeExtent[0] = new Date(timeExtent[0].getTime() - 60000);
      timeExtent[1] = new Date(timeExtent[1].getTime() + 60000);
    } else if (!timeExtent[0]) {
       timeExtent[0] = new Date();
       timeExtent[1] = new Date(Date.now() + 60000);
    }

    const x = d3.scaleTime()
      .domain(timeExtent)
      .range([0, width]);

    // Y Scale (Agents)
    const y = d3.scaleBand()
      .domain(agents.map(d => d.id))
      .range([0, height])
      .padding(0.5);

    // Add X Axis
    svg.append("g")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(x).ticks(5).tickFormat(d3.timeFormat("%H:%M:%S")))
      .attr("color", "#94a3b8")
      .attr("font-size", "10px")
      .attr("font-weight", "bold");

    // Add Y Axis (Agent Names)
    svg.append("g")
      .call(d3.axisLeft(y).tickFormat(id => agents.find(a => a.id === id)?.name || id))
      .attr("color", "#64748b")
      .attr("font-size", "11px")
      .attr("font-weight", "bold")
      .selectAll(".domain, .tick line")
      .remove();

    // Add subtle grid lines for rows
    svg.append("g")
      .selectAll("line")
      .data(agents)
      .enter()
      .append("line")
      .attr("x1", 0)
      .attr("x2", width)
      .attr("y1", d => y(d.id) + y.bandwidth() / 2)
      .attr("y2", d => y(d.id) + y.bandwidth() / 2)
      .attr("stroke", "#f1f5f9")
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "4,4");

    // Plot the events as glowing dots
    const dots = svg.append("g")
      .selectAll("circle")
      .data(mappedEvents)
      .enter()
      .append("circle")
      .attr("cx", d => x(d.time))
      .attr("cy", d => y(d.agentId) + y.bandwidth() / 2)
      .attr("r", 0) // Start at 0 for animation
      .attr("fill", "#3b82f6")
      .attr("stroke", "#eff6ff")
      .attr("stroke-width", 2)
      .style("filter", "drop-shadow(0px 0px 4px rgba(59, 130, 246, 0.5))");

    // Animate dots in
    dots.transition()
      .duration(500)
      .attr("r", 6);

    // Add tooltip
    const tooltip = d3.select(svgRef.current.parentElement)
      .append("div")
      .style("opacity", 0)
      .style("position", "absolute")
      .style("background-color", "white")
      .style("border", "1px solid #e2e8f0")
      .style("border-radius", "8px")
      .style("padding", "8px")
      .style("font-size", "10px")
      .style("font-weight", "bold")
      .style("color", "#475569")
      .style("pointer-events", "none")
      .style("box-shadow", "0 4px 6px -1px rgb(0 0 0 / 0.1)");

    dots.on("mouseover", (event, d) => {
        d3.select(event.currentTarget).attr("r", 8).attr("fill", "#2563eb");
        tooltip.transition().duration(200).style("opacity", 1);
        tooltip.html(`Patient: ${d.patientName}<br/>Event: ${d.event}<br/>Time: ${d.time.toLocaleTimeString()}`)
          .style("left", (event.pageX + 10) + "px")
          .style("top", (event.pageY - 28) + "px");
      })
      .on("mouseout", (event) => {
        d3.select(event.currentTarget).attr("r", 6).attr("fill", "#3b82f6");
        tooltip.transition().duration(500).style("opacity", 0);
      });

    return () => {
      d3.select(svgRef.current.parentElement).selectAll("div").remove(); // Cleanup tooltip
    };

  }, [events]);

  return (
    <div className="w-full overflow-x-auto relative">
      <svg ref={svgRef} className="w-full" style={{ minWidth: '600px' }}></svg>
    </div>
  );
}