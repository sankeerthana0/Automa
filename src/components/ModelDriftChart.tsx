import React, { useState } from "react";
import { Activity } from "lucide-react";

interface ModelDriftChartProps {
  history: {
    timestamps: string[];
    accuracy: number[];
    confidence: number[];
    latency: number[];
    drift: number[];
  };
}

export default function ModelDriftChart({ history }: ModelDriftChartProps) {
  const [activeTab, setActiveTab] = useState<"accuracy" | "latency" | "drift">("accuracy");

  const dataPoints = history.timestamps.length;
  if (dataPoints === 0) {
    return (
      <div className="h-44 flex items-center justify-center text-slate-500 font-mono text-[11px] bg-white border border-[#141414]">
        NO ACTIVE TELEMETRY STREAMS CONNECTED
      </div>
    );
  }

  // Render SVG charts inside 500x130 boundary
  const width = 500;
  const height = 130;
  const padding = 15;

  // Compute scale boundaries
  let activeData: number[] = [];
  let color = "#141414"; // high-contrast black line in theme
  let strokeColor = "#16a34a"; // accent color
  let fillGlow = "rgba(22, 163, 74, 0.08)";
  let label = "";

  if (activeTab === "accuracy") {
    activeData = history.accuracy;
    strokeColor = "#16a34a"; // Emerald green
    fillGlow = "rgba(22, 163, 74, 0.06)";
    label = "Accuracy";
  } else if (activeTab === "latency") {
    activeData = history.latency;
    strokeColor = "#d97706"; // Amber orange
    fillGlow = "rgba(217, 119, 6, 0.06)";
    label = "Latency (ms)";
  } else {
    activeData = history.drift;
    strokeColor = "#dc2626"; // Failure Red
    fillGlow = "rgba(220, 38, 38, 0.06)";
    label = "Covariate Drift (KS)";
  }

  const minVal = Math.min(...activeData) * 0.98;
  const maxVal = Math.max(...activeData) * 1.02;
  const delta = maxVal - minVal === 0 ? 1 : maxVal - minVal;

  // Create SVG points
  const points = activeData.map((val, idx) => {
    const x = padding + (idx / (dataPoints - 1)) * (width - padding * 2);
    const percentY = (val - minVal) / delta;
    const y = height - padding - percentY * (height - padding * 2);
    return { x, y, val };
  });

  const pathD = points.reduce((acc, point, idx) => {
    if (idx === 0) return `M ${point.x} ${point.y}`;
    const prev = points[idx - 1];
    const cp1x = prev.x + (point.x - prev.x) / 2;
    const cp1y = prev.y;
    const cp2x = prev.x + (point.x - prev.x) / 2;
    const cp2y = point.y;
    return `${acc} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${point.x} ${point.y}`;
  }, "");

  const areaD = pathD ? `${pathD} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z` : "";

  return (
    <div className="bg-[#fdfdfc] border border-[#141414] p-4 flex flex-col h-full" id="drift-chart-container">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3 pb-3 border-b border-[#141414]/10">
        <div className="flex items-center gap-2">
          <Activity className="h-3.5 w-3.5 text-[#141414]" />
          <span className="text-[11px] font-bold uppercase tracking-widest text-[#141414]">
            Continuous Telemetry
          </span>
        </div>
        <div className="flex gap-1 bg-[#E4E3E0] p-0.5 border border-[#141414]">
          <button
            id="tab-btn-accuracy"
            onClick={() => setActiveTab("accuracy")}
            className={`px-2 py-0.5 text-[10px] uppercase font-mono tracking-tighter transition-all ${
              activeTab === "accuracy"
                ? "bg-[#141414] text-white font-bold"
                : "text-[#141414] hover:bg-white/40"
            }`}
          >
            Accuracy
          </button>
          <button
            id="tab-btn-latency"
            onClick={() => setActiveTab("latency")}
            className={`px-2 py-0.5 text-[10px] uppercase font-mono tracking-tighter transition-all ${
              activeTab === "latency"
                ? "bg-[#141414] text-white font-bold"
                : "text-[#141414] hover:bg-white/40"
            }`}
          >
            Latency
          </button>
          <button
            id="tab-btn-drift"
            onClick={() => setActiveTab("drift")}
            className={`px-2 py-0.5 text-[10px] uppercase font-mono tracking-tighter transition-all ${
              activeTab === "drift"
                ? "bg-[#141414] text-white font-bold"
                : "text-[#141414] hover:bg-white/40"
            }`}
          >
            Drift KS
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col justify-between">
        {/* Render Chart Line */}
        <div className="w-full bg-[#E4E3E0]/20 rounded-none p-1.5 border border-[#141414]/40 overflow-hidden relative">
          <div className="absolute top-1.5 right-2 text-[9px] font-mono opacity-40 uppercase">
            Live Stream ({dataPoints} pts)
          </div>
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible">
            {/* Grid Line Marks */}
            <line x1={padding} y1={padding} x2={width - padding} y2={padding} stroke="#d1d1cf" strokeWidth="1" strokeDasharray="3 3" />
            <line x1={padding} y1={height / 2} x2={width - padding} y2={height / 2} stroke="#d1d1cf" strokeWidth="1" strokeDasharray="3 3" />
            <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#141414" strokeWidth="1" />

            {/* Shaded Area */}
            {areaD && <path d={areaD} fill={fillGlow} />}

            {/* Main Path */}
            {pathD && <path d={pathD} fill="none" stroke={strokeColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />}

            {/* Render Nodes for points in the history */}
            {points.map((pt, idx) => (
              <g key={idx} className="group cursor-pointer">
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={idx === points.length - 1 ? "4" : "2"}
                  fill={idx === points.length - 1 ? strokeColor : "#141414"}
                  stroke={strokeColor}
                  strokeWidth="1"
                />
                <title>{`${label}: ${pt.val.toFixed(3)}`}</title>
              </g>
            ))}
          </svg>
        </div>

        {/* Legend stats overlay */}
        <div className="grid grid-cols-3 gap-2 mt-2 pt-2 border-t border-[#141414]/10 text-center text-[10px] font-mono">
          <div className="bg-[#E4E3E0]/30 py-1 border border-[#141414]/10">
            <span className="block opacity-60 text-[8px] uppercase">Current</span>
            <span className="font-bold text-[#141414]">
              {activeData[activeData.length - 1]?.toFixed(2) ?? "N/A"}
              {activeTab === "accuracy" ? "%" : activeTab === "latency" ? "ms" : ""}
            </span>
          </div>
          <div className="bg-[#E4E3E0]/30 py-1 border border-[#141414]/10">
            <span className="block opacity-60 text-[8px] uppercase">Peak Max</span>
            <span className="font-semibold text-slate-800">
              {Math.max(...activeData).toFixed(2)}
              {activeTab === "accuracy" ? "%" : activeTab === "latency" ? "ms" : ""}
            </span>
          </div>
          <div className="bg-[#E4E3E0]/30 py-1 border border-[#141414]/10">
            <span className="block opacity-60 text-[8px] uppercase">Base Min</span>
            <span className="font-semibold text-slate-800">
              {Math.min(...activeData).toFixed(2)}
              {activeTab === "accuracy" ? "%" : activeTab === "latency" ? "ms" : ""}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
