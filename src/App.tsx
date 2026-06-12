import React, { useState, useEffect, useRef } from "react";
import { 
  Play, 
  CheckCircle, 
  AlertTriangle, 
  Trash2, 
  Send, 
  HelpCircle, 
  Activity, 
  FileText, 
  FileCode, 
  Database, 
  Server, 
  Terminal, 
  Cpu, 
  ShieldAlert, 
  Layers, 
  Maximize2,
  Minimize2,
  ChevronRight,
  ChevronDown
} from "lucide-react";
import ModelDriftChart from "./components/ModelDriftChart.js";
import { SystemMetrics, LogLine, Anomaly, SimulationState, AgentMessage } from "./types.js";

interface Agent {
  id: string;
  name: string;
  role: string;
  status: "IDLE" | "INVESTIGATING" | "ACTIVE" | "SCANNING" | "DONE" | "FAILED";
  colorText: string;
  borderColor: string;
  avatar: string;
  description: string;
}

export default function App() {
  const [state, setState] = useState<SimulationState>({
    metrics: {
      cpu: 28,
      memory: 42,
      gpu: 15,
      requestCount: 320,
      apiLatency: 45,
      apiErrorRate: 0.1,
      modelAccuracy: 94.2,
      modelConfidence: 89.5,
      f1Score: 93.8,
      inputDriftScore: 0.08,
      dockerStatus: "healthy",
    },
    history: {
      timestamps: [],
      accuracy: [],
      confidence: [],
      latency: [],
      drift: [],
    },
    activeAnomalies: [],
    logs: [],
    agentMessages: [],
  });

  const [loadingAgents, setLoadingAgents] = useState(false);
  const [activeReportTab, setActiveReportTab] = useState<string>("log-analyzer");
  const [chatSelectedAgent, setChatSelectedAgent] = useState<string>("log-analyzer");
  const [chatMessage, setChatMessage] = useState<string>("");
  const [chatHistory, setChatHistory] = useState<Array<{ sender: string; message: string; timestamp: string; isAgent: boolean }>>([]);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const logsEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Poll state updates
  const fetchState = async (showLoadingDot = false) => {
    if (showLoadingDot) setIsRefreshing(true);
    try {
      const res = await fetch("/api/state");
      if (res.ok) {
        const data = await res.json();
        setState(data);
      }
    } catch (err) {
      console.error("Error loading telemetry state:", err);
    } finally {
      if (showLoadingDot) setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchState();
    const interval = setInterval(() => fetchState(), 4000);
    return () => clearInterval(interval);
  }, []);

  // Scroll logs to bottom
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [state.logs]);

  // Active agents manifest
  const agents: Agent[] = [
    {
      id: "log-analyzer",
      name: "Log_Analysis_Bot",
      role: "Python Log & Root Cause Analyzer",
      status: state.activeAnomalies.some(a => !a.resolved) 
        ? (loadingAgents ? "INVESTIGATING" : "DONE") 
        : "ACTIVE",
      colorText: "text-emerald-700",
      borderColor: "border-emerald-600",
      avatar: "⚙️",
      description: "Scans traceback indices to isolate model payload structural faults."
    },
    {
      id: "model-quality",
      name: "Quality_Sentinel",
      role: "Validation Monitor & Concept Drift Tracker",
      status: state.activeAnomalies.some(a => !a.resolved)
        ? (loadingAgents ? "SCANNING" : "DONE")
        : "SCANNING",
      colorText: "text-amber-700",
      borderColor: "border-amber-600",
      avatar: "📊",
      description: "Computes Kolmogorov-Smirnov distribution margins over predictions."
    },
    {
      id: "deployment",
      name: "Deployment_Agent",
      role: "Container Scheduler & Host Allocator",
      status: state.activeAnomalies.some(a => !a.resolved)
        ? (loadingAgents ? "INVESTIGATING" : "DONE")
        : "IDLE",
      colorText: "text-blue-700",
      borderColor: "border-blue-600",
      avatar: "🐳",
      description: "Controls CUDA threads allocation memory buffers inside YAML manifests."
    },
    {
      id: "documentation",
      name: "Doc_Generator",
      role: "Disaster Recovery Writer",
      status: state.activeAnomalies.some(a => !a.resolved)
        ? (loadingAgents ? "INVESTIGATING" : "DONE")
        : "IDLE",
      colorText: "text-indigo-700",
      borderColor: "border-indigo-600",
      avatar: "📝",
      description: "Drafts dynamic operational repair cookbooks for production operators."
    },
    {
      id: "summarizer",
      name: "Incident_Summary",
      role: "Post-Mortem Executive Compiler",
      status: state.activeAnomalies.some(a => !a.resolved)
        ? (loadingAgents ? "INVESTIGATING" : "DONE")
        : "IDLE",
      colorText: "text-slate-800",
      borderColor: "border-slate-600",
      avatar: "📋",
      description: "Consolidates cross-agent diagnostics into clear Post-Mortem reports."
    },
  ];

  // Trigger automated analysis sequence across all agents
  const triggerCooperativeAnalysis = async () => {
    setLoadingAgents(true);
    try {
      const res = await fetch("/api/agent/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ debug: true })
      });
      if (res.ok) {
        await fetchState();
      }
    } catch (err) {
      console.error("Failed triggering diagnostics queue", err);
    } finally {
      setTimeout(() => {
        setLoadingAgents(false);
      }, 1500);
    }
  };

  // Inject failure scenario
  const injectAnomaly = async (type: "drift" | "exception" | "docker_crash" | "latency") => {
    const payloads = {
      drift: {
        name: "Covariate Drift Detected",
        severity: "medium" as const,
        description: "Prediction distribution bounds drifted. Kolmogorov-Smirnov metric (0.45) breached limit (0.20)."
      },
      exception: {
        name: "FastAPI Pipeline Exception",
        severity: "high" as const,
        description: "ValueError on model features dimension. Pipeline expected 18 columns, instead received 14."
      },
      docker_crash: {
        name: "Docker Container Memory Crash",
        severity: "critical" as const,
        description: "PyTorch memory heap leak. PyTorch CUDA Out Of Memory. Container exited abnormal with exit code 139."
      },
      latency: {
        name: "API Latency Warning",
        severity: "low" as const,
        description: "Uvicorn REST interface latency peaked at 1250ms due to database connection pool exhaustion."
      }
    };

    try {
      await fetch("/api/inject-anomaly", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          ...payloads[type]
        })
      });
      await fetchState();
      // Auto run diagnostic agent evaluations right after anomaly injection for high interactivity!
      triggerCooperativeAnalysis();
    } catch (err) {
      console.error("Failed to inject anomaly:", err);
    }
  };

  // Resolve anomalies
  const resolveAnomalies = async () => {
    try {
      await fetch("/api/resolve-anomalies", { method: "POST" });
      await fetchState();
    } catch (err) {
      console.error("Failed to resolve anomalies:", err);
    }
  };

  // Clear system audit logs
  const clearAgentLogs = async () => {
    try {
      await fetch("/api/agent/clear", { method: "POST" });
      setChatHistory([]);
      await fetchState();
    } catch (err) {
      console.error("Failed to clear logs:", err);
    }
  };

  // Chat/Prompt with individual agent
  const sendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMessage.trim()) return;

    const userText = chatMessage;
    setChatMessage("");

    const targetAgent = agents.find(a => a.id === chatSelectedAgent);
    const agentNameStr = targetAgent ? targetAgent.name : "Agent Expert";

    // Add user message to local context
    const timestampStr = new Date().toLocaleTimeString();
    setChatHistory(prev => [...prev, {
      sender: "Developer",
      message: userText,
      timestamp: timestampStr,
      isAgent: false
    }]);

    try {
      const res = await fetch("/api/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: chatSelectedAgent,
          userMessage: userText
        })
      });
      if (res.ok) {
        const data = await res.json();
        setChatHistory(prev => [...prev, {
          sender: agentNameStr,
          message: data.reply,
          timestamp: new Date().toLocaleTimeString(),
          isAgent: true
        }]);
        await fetchState();
      }
    } catch (err) {
      console.error("Agent chat failed:", err);
    }
  };

  // A helper function to parse markdown string into visually clean HTML paragraph structures
  const renderMarkdown = (text: string) => {
    if (!text) return <p className="opacity-60 font-mono text-[11px]">No diagnostic data available. Click "Trigger Cooperative Agent Review" to generate reports.</p>;
    
    const lines = text.split("\n");
    return lines.map((line, idx) => {
      // Headers
      if (line.startsWith("###")) {
        return (
          <h4 key={idx} className="font-sans font-bold text-xs uppercase tracking-tight text-[#141414] mt-4 mb-2 first:mt-0 class-header-r font-black">
            {line.replace("###", "").trim()}
          </h4>
        );
      }
      if (line.startsWith("####")) {
        return (
          <h5 key={idx} className="font-sans font-bold text-[11px] text-slate-800 uppercase mt-3 mb-1 first:mt-0 font-bold">
            {line.replace("####", "").trim()}
          </h5>
        );
      }
      // Bullet items
      if (line.trim().startsWith("- ") || line.trim().startsWith("* ")) {
        return (
          <li key={idx} className="ml-4 list-disc text-xs leading-relaxed text-[#141414]/90 my-1 font-sans">
            {line.replace(/^[\s-*]+/, "").trim()}
          </li>
        );
      }
      // Table rows mapping
      if (line.includes("|") && !line.includes("---")) {
        const columns = line.split("|").map(col => col.trim()).filter(col => col !== "");
        return (
          <div key={idx} className="grid grid-cols-3 gap-2 py-1 px-2 border-b border-[#141414]/10 text-[10px] font-mono bg-white/40">
            {columns.map((c, i) => (
              <span key={i} className={i === 0 ? "font-bold" : ""}>{c}</span>
            ))}
          </div>
        );
      }
      // Code blocks formatting
      if (line.startsWith("```")) {
        return null; // hide tags
      }
      if (line.includes("`")) {
        // inline styling fallback helper
        return (
          <p key={idx} className="text-xs font-mono leading-relaxed text-[#141414]/90 my-1.5 break-words bg-[#E4E3E0]/30 p-1 border-l border-[#141414]/40">
            {line}
          </p>
        );
      }

      return (
        <p key={idx} className="text-xs leading-relaxed text-[#141414]/90 my-1 font-sans">
          {line}
        </p>
      );
    });
  };

  const activeAnomaly = state.activeAnomalies.find((a) => !a.resolved);

  return (
    <div className="min-h-screen bg-[#E4E3E0] text-[#141414] flex flex-col font-sans select-none antialiased md:p-3 lg:p-4">
      
      {/* Outer Rigid Container Box to match the 1024x768 structure beautifully & responsibly */}
      <div className="w-full max-w-7xl mx-auto bg-[#E4E3E0] border-4 sm:border-8 border-[#141414] flex flex-col shadow-[12px_12px_0px_0px_rgba(20,20,20,1)] overflow-hidden" id="main-control-tower">
        
        {/* HEADER */}
        <header className="h-16 border-b-4 border-[#141414] flex flex-col sm:flex-row items-center px-4 sm:px-6 justify-between bg-white shrink-0 gap-3 py-3 sm:py-0">
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 bg-[#141414] rotate-45 shrink-0 animate-ping" style={{ animationDuration: '3s' }}></div>
            <div className="flex flex-col">
              <h1 className="text-base sm:text-lg font-black tracking-tighter uppercase font-sans">
                AUTOMA-MLOPS // CONTROL TOWER
              </h1>
              <span className="text-[9px] text-[#141414]/60 font-mono -mt-1 uppercase tracking-wider">
                Multi-Agent System & Automated Model Maintenance v2.4.0
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-4 sm:gap-6 text-[10px] sm:text-[11px] font-medium uppercase tracking-widest font-mono">
            <div className="flex items-center gap-1.5">
              <span>Telemetry:</span>
              <span className={activeAnomaly ? "text-amber-600 font-bold animate-pulse" : "text-emerald-600 font-bold"}>
                {activeAnomaly ? "● ALERT" : "● OPTIMAL"}
              </span>
            </div>
            <span>Agents: <b className="font-bold">05 ONLINE</b></span>
            <span className="hidden md:inline">Platform: <b className="font-bold">GCP / DOCKER</b></span>
          </div>
        </header>

        {/* WORKSPACE DIVIDER */}
        <div className="flex flex-col lg:flex-row flex-1 overflow-hidden min-h-[600px] lg:h-[720px]">
          
          {/* LEFT COLUMN: SIDEBAR */}
          <aside className="w-full lg:w-72 border-b-4 lg:border-b-0 lg:border-r-4 border-[#141414] flex flex-col bg-white/60 shrink-0">
            
            {/* Orchestration Section */}
            <div className="p-4 border-b-2 border-[#141414] bg-white text-xs">
              <span className="font-serif italic text-[11px] opacity-70 uppercase block mb-3 font-semibold text-[#141414]">
                Orchestration Engine
              </span>
              
              <ul className="space-y-1.5">
                {agents.map((agent) => {
                  const isActive = chatSelectedAgent === agent.id;
                  const isInvestigating = agent.status === "INVESTIGATING" || agent.status === "SCANNING";
                  return (
                    <li 
                      key={agent.id}
                      onClick={() => {
                        setChatSelectedAgent(agent.id);
                        setActiveReportTab(agent.id);
                      }}
                      className={`flex items-center justify-between p-2.5 border-2 border-[#141414] transition-colors cursor-pointer ${
                        isActive 
                          ? "bg-[#141414] text-white" 
                          : "bg-[#fdfdfc] hover:bg-white text-[#141414]"
                      }`}
                      title={agent.description}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs">{agent.avatar}</span>
                        <span className="font-mono text-[11px] font-bold">{agent.name}</span>
                      </div>
                      
                      <span className={`text-[9px] font-black px-1.5 py-0.5 font-mono ${
                        isInvestigating 
                          ? "bg-amber-500 text-black animate-pulse"
                          : (agent.status === "ACTIVE" 
                            ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                            : (agent.status === "DONE" 
                              ? "bg-[#141414] text-[#E4E3E0]" 
                              : "bg-[#E4E3E0] text-slate-800 opacity-60"))
                      }`}>
                        {agent.status}
                      </span>
                    </li>
                  );
                })}
              </ul>

              <div className="mt-4 pt-4 border-t border-[#141414]/15">
                <button
                  onClick={triggerCooperativeAnalysis}
                  disabled={loadingAgents || !activeAnomaly}
                  className="w-full py-2 bg-[#141414] text-white hover:bg-slate-800 font-bold uppercase text-[10px] font-mono tracking-widest disabled:opacity-45 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all border border-transparent active:scale-[0.98]"
                  id="btn-cooperative-diagnostics"
                >
                  <Cpu className="h-3 w-3 animate-spin" style={{ animationDuration: loadingAgents ? '1.5s' : '0s' }} />
                  {loadingAgents ? "DIAGNOSING..." : "COOPERATIVE ANALYSIS"}
                </button>
              </div>
            </div>

            {/* Live Agent Communication Feed */}
            <div className="flex-1 p-4 flex flex-col overflow-hidden min-h-[180px] lg:h-auto">
              <span className="font-serif italic text-[11px] opacity-70 uppercase block mb-3 font-semibold text-[#141414]">
                Agent Audit History
              </span>
              
              <div 
                ref={scrollContainerRef}
                className="flex-1 overflow-y-auto font-mono text-[10px] space-y-2 opacity-90 p-2 bg-slate-950/5 border border-[#141414] max-h-[220px] lg:max-h-none"
              >
                {state.agentMessages.length === 0 ? (
                  <p className="opacity-40 italic py-10 text-center">No diagnostic events processed. Active alerts trigger cooperative logging outputs.</p>
                ) : (
                  state.agentMessages.map((msg) => {
                    const msgAgent = agents.find(a => a.id === msg.agentId);
                    const agentName = msgAgent ? msgAgent.name : "Core_Tower";
                    const isThought = msg.type === "thought";
                    
                    return (
                      <div key={msg.id} className={`p-1.5 border-b border-[#141414]/5 last:border-0 ${isThought ? "bg-amber-500/10" : ""}`}>
                        <div className="flex justify-between text-[8px] opacity-50 mb-0.5">
                          <span>@{agentName}</span>
                          <span>{new Date(msg.timestamp).toLocaleTimeString()}</span>
                        </div>
                        <p className={isThought ? "text-amber-800 italic" : "text-[#141414]"}>
                          {isThought ? `[THOUGHT] ${msg.message}` : msg.message.slice(0, 75) + (msg.message.length > 75 ? "..." : "")}
                        </p>
                      </div>
                    );
                  })
                )}
              </div>
              
              <div className="mt-2 text-right">
                <button 
                  onClick={clearAgentLogs}
                  className="text-[9px] uppercase tracking-tighter hover:underline text-red-700 font-mono font-bold flex items-center gap-1 ml-auto"
                >
                  <Trash2 className="h-2.5 w-2.5" /> Clear History
                </button>
              </div>
            </div>
          </aside>

          {/* MAIN SPACE: METRICS + DIAGNOSTICS */}
          <main className="flex-1 flex flex-col bg-[#E4E3E0] overflow-y-auto lg:overflow-hidden">
            
            {/* TOP SUMMARY STATS SECTION */}
            <section className="border-b-4 border-[#141414] grid grid-cols-2 md:grid-cols-4 bg-white shrink-0">
              
              <div className="border-r-2 md:border-r-4 border-b border-b-[#141414] md:border-b-0 border-[#141414]/10 md:border-[#141414] p-4 flex flex-col justify-between hover:bg-[#E4E3E0]/15 transition-colors">
                <span className="font-serif italic text-[11px] opacity-70 uppercase font-semibold">Avg Latency (REST)</span>
                <span className={`text-2xl sm:text-3xl font-mono tracking-tighter font-black mt-2 ${
                  state.metrics.apiLatency > 300 ? "text-amber-600" : "text-[#141414]"
                }`}>
                  {state.metrics.apiLatency.toFixed(0)}<span className="text-xs sm:text-sm font-sans font-normal lowercase opacity-70"> ms</span>
                </span>
                <span className="text-[9px] font-mono text-slate-500 tracking-tighter mt-1 block">Uvicorn API Workers</span>
              </div>
              
              <div className="border-r-0 md:border-r-4 border-b border-b-[#141414] md:border-b-0 border-[#141414]/10 md:border-[#141414] p-4 flex flex-col justify-between hover:bg-[#E4E3E0]/15 transition-colors">
                <span className="font-serif italic text-[11px] opacity-70 uppercase font-semibold">Model Confidence</span>
                <span className={`text-2xl sm:text-3xl font-mono tracking-tighter font-black mt-2 ${
                  state.metrics.modelConfidence < 80 ? "text-red-600" : "text-emerald-700"
                }`}>
                  {state.metrics.modelConfidence.toFixed(1)}<span className="text-xs sm:text-sm font-sans font-normal">%</span>
                </span>
                <span className="text-[9px] font-mono text-slate-500 tracking-tighter mt-1 block">Inference Confidence Interval</span>
              </div>
              
              <div className="border-r-2 border-[#141414]/10 md:border-[#141414] p-4 flex flex-col justify-between hover:bg-[#E4E3E0]/15 transition-colors">
                <span className="font-serif italic text-[11px] opacity-70 uppercase font-semibold">Covariate Drift</span>
                <span className={`text-2xl sm:text-3xl font-mono tracking-tighter font-black mt-2 ${
                  state.metrics.inputDriftScore > 0.20 ? "text-red-600 animate-pulse" : "text-[#141414]"
                }`}>
                  {state.metrics.inputDriftScore.toFixed(3)}<span className="text-xs font-sans font-normal lowercase opacity-70"> KS</span>
                </span>
                <span className="text-[9px] font-mono text-slate-500 tracking-tighter mt-1 block">Limit Threshold: 0.200</span>
              </div>
              
              <div className="p-4 flex flex-col justify-between hover:bg-[#E4E3E0]/15 transition-colors">
                <span className="font-serif italic text-[11px] opacity-70 uppercase font-semibold">Pipeline Errors</span>
                <span className={`text-2xl sm:text-3xl font-mono tracking-tighter font-black mt-2 ${
                  state.metrics.apiErrorRate > 10 ? "text-red-600 font-extrabold" : "text-[#141414]"
                }`}>
                  {state.metrics.apiErrorRate.toFixed(2)}<span className="text-xs sm:text-sm font-sans font-normal">%</span>
                </span>
                <span className="text-[9px] font-mono text-slate-500 tracking-tighter mt-1 block">REST HTTP 5xx Failures</span>
              </div>
            </section>

            {/* SPLIT COLUMN: CRITICAL CONTROLS & MODEL CHARTS */}
            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 overflow-hidden bg-[#E4E3E0]">
              
              {/* LEFT DIV: LOG ANALYSIS & TESTING ACTIONS */}
              <div className="border-b border-[#141414] md:border-b-0 md:border-r-4 border-[#141414] flex flex-col overflow-hidden max-h-[600px] md:max-h-none">
                
                {/* Header title */}
                <div className="p-3 border-b-2 border-[#141414] flex justify-between items-center bg-white shrink-0">
                  <span className="text-[11px] font-bold uppercase tracking-widest text-[#141414] font-sans flex items-center gap-1.5">
                    <Terminal className="h-3.5 w-3.5" /> Live Log Telemetry & Simulation Injector
                  </span>
                  
                  {activeAnomaly ? (
                    <span className="text-[9px] font-mono bg-red-100 text-red-800 px-2.5 py-0.5 border border-red-800 font-bold animate-bounce uppercase">
                      CRITICAL FAULT
                    </span>
                  ) : (
                    <span className="text-[9px] font-mono bg-emerald-100 text-emerald-800 px-2.5 py-0.5 border border-emerald-800 font-bold uppercase">
                      STABLE CONTEXT
                    </span>
                  )}
                </div>

                {/* Simulated Logs Stream */}
                <div className="flex-1 p-3 font-mono text-[11px] overflow-y-auto space-y-2 bg-[#fdfdfc] max-h-[300px] md:max-h-none">
                  <div className="sticky top-0 bg-[#fdfdfc] pb-2 border-b border-[#141414]/5 flex justify-between text-[9px] text-[#141414]/50">
                    <span>Forwarding Stream (Datadog Agent 12201 port)</span>
                    <button 
                      onClick={() => fetchState(true)}
                      className="hover:underline hover:text-[#141414] uppercase flex items-center gap-1 font-bold"
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${isRefreshing ? "bg-amber-500 animate-spin" : "bg-emerald-500"}`}></span>
                      SYNC SYSTEM
                    </button>
                  </div>

                  <div className="space-y-1.5">
                    {state.logs.map((log) => {
                      const isError = log.level === "ERROR" || log.level === "CRITICAL";
                      const isWarning = log.level === "WARNING";
                      const isExpanded = expandedLogId === log.id;
                      
                      return (
                        <div 
                          key={log.id} 
                          className={`p-2 border-2 transition-all ${
                            isError 
                              ? "bg-red-50 border-red-700/80 text-red-900" 
                              : isWarning 
                                ? "bg-amber-50 border-amber-600/80 text-amber-900" 
                                : "bg-slate-50 border-slate-300 text-slate-800 hover:bg-slate-100"
                          }`}
                        >
                          <div className="flex justify-between items-center text-[9px] opacity-80 cursor-pointer" onClick={() => setExpandedLogId(isExpanded ? null : log.id)}>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold">{log.service.toUpperCase()}</span>
                              <span className="opacity-60">|</span>
                              <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                            </div>
                            <div className="flex items-center gap-1 font-bold">
                              <span className={`px-1 rounded text-[8px] ${
                                isError ? "bg-red-200" : isWarning ? "bg-amber-200" : "bg-slate-200"
                              }`}>{log.level}</span>
                              {log.payload && (
                                <span>{isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}</span>
                              )}
                            </div>
                          </div>
                          
                          <p className="mt-1 font-mono text-[10px] break-all select-all font-semibold leading-relaxed">
                            {log.message}
                          </p>

                          {log.payload && isExpanded && (
                            <pre className="mt-2 p-2 bg-[#141414] text-[#E4E3E0] text-[9px] rounded-none overflow-x-auto whitespace-pre font-mono leading-tight border border-slate-700 max-h-48">
                              {log.payload}
                            </pre>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div ref={logsEndRef} />
                </div>

                {/* Simulations Cockpit Footer Actions */}
                <div className="p-4 border-t-4 border-[#141414] bg-white shrink-0">
                  <span className="font-serif italic text-xs opacity-70 uppercase tracking-tight block mb-2.5 font-bold text-[#141414]">
                    Failure Simulation Scenarios Terminal
                  </span>
                  
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <button
                      onClick={() => injectAnomaly("drift")}
                      className="px-2 py-1.5 bg-[#E4E3E0] hover:bg-[#141414] hover:text-white border-2 border-[#141414] text-[10px] font-mono font-bold uppercase transition-colors"
                      id="btn-inject-drift"
                    >
                      🚀 Data Concept Drift
                    </button>
                    <button
                      onClick={() => injectAnomaly("exception")}
                      className="px-2 py-1.5 bg-[#E4E3E0] hover:bg-[#141414] hover:text-white border-2 border-[#141414] text-[10px] font-mono font-bold uppercase transition-colors"
                      id="btn-inject-error"
                    >
                      💥 Python Dimension Mismatch
                    </button>
                    <button
                      onClick={() => injectAnomaly("docker_crash")}
                      className="px-2 py-1.5 bg-[#E4E3E0] hover:bg-[#141414] hover:text-white border-2 border-[#141414] text-[10px] font-mono font-bold uppercase transition-colors"
                      id="btn-inject-crash"
                    >
                      🐳 Docker RAM OOM Crash
                    </button>
                    <button
                      onClick={() => injectAnomaly("latency")}
                      className="px-2 py-1.5 bg-[#E4E3E0] hover:bg-[#141414] hover:text-white border-2 border-[#141414] text-[10px] font-mono font-bold uppercase transition-colors"
                      id="btn-inject-latency"
                    >
                      ⏳ DB Connection Pool Latency
                    </button>
                  </div>

                  <div className="flex gap-2">
                    <button 
                      onClick={resolveAnomalies}
                      className="flex-1 py-2 bg-emerald-700 hover:bg-emerald-800 text-white border-2 border-[#141414] uppercase text-[10px] font-mono font-bold tracking-wider flex items-center justify-center gap-1.5 active:scale-[0.98]"
                      id="btn-resolve-anomalies"
                    >
                      <CheckCircle className="h-3 w-3" /> manual mitigation patch
                    </button>
                  </div>
                </div>

              </div>

              {/* RIGHT DIV: RETRAINING PLOTS, AGENT MANUALS & ASK INTERACTIVE CORE */}
              <div className="flex flex-col overflow-hidden max-h-[600px] md:max-h-none">
                
                {/* Visual Chart Element */}
                <div className="shrink-0 h-56">
                  <ModelDriftChart history={state.history} />
                </div>

                {/* Tabbed workspace showing what the automatic agents drafted */}
                <div className="flex-1 flex flex-col border-t-4 border-[#141414] overflow-hidden bg-white">
                  
                  {/* Tabs header */}
                  <div className="flex border-b-2 border-[#141414] bg-[#E4E3E0]/40 overflow-x-auto shrink-0 select-none">
                    {agents.map((ag) => {
                      const isSelected = activeReportTab === ag.id;
                      return (
                        <button
                          key={ag.id}
                          onClick={() => setActiveReportTab(ag.id)}
                          className={`px-3 py-2 font-mono text-[9px] md:text-[10px] uppercase font-bold border-r border-[#141414] transition-all whitespace-nowrap ${
                            isSelected 
                              ? "bg-white text-[#141414] border-b-2 border-b-white -mb-[2px]" 
                              : "text-slate-600 hover:bg-[#E4E3E0]"
                          }`}
                        >
                          {ag.avatar} {ag.name.replace("_Agent", "").replace("_Bot", "").replace("_Sentinel", "")}
                        </button>
                      );
                    })}
                  </div>

                  {/* Reports text container */}
                  <div className="flex-1 p-4 overflow-y-auto bg-[#fafaf8] max-h-[300px] md:max-h-none">
                    
                    {/* Render active report depending on message history from backend */}
                    <div className="space-y-3">
                      
                      {state.agentMessages.filter((m) => m.agentId === activeReportTab && m.type === "output").length === 0 ? (
                        <div className="h-40 flex flex-col items-center justify-center text-center p-6 border-2 border-dashed border-[#141414]/15">
                          <HelpCircle className="h-6 w-6 text-slate-400 mb-2" />
                          <h4 className="font-mono text-[10px] font-bold text-[#141414] uppercase">Diagnostic Report Empty</h4>
                          <p className="text-[10px] font-sans text-slate-500 mt-1 max-w-xs leading-relaxed">
                            No report available for <b className="font-mono text-[10.5px] font-bold">@{agents.find(a => a.id === activeReportTab)?.name}</b>. Select "Concepts Drift" or "FastAPI mismatch" button on the simulation cockpit to trigger diagnostics.
                          </p>
                        </div>
                      ) : (
                        <div className="prose max-w-none prose-sm leading-relaxed text-[#141414]">
                          {/* Status and title metadata inside report */}
                          <div className="flex items-center justify-between border-b pb-2 mb-3 border-[#141414]/10 text-[9px] font-mono">
                            <span className="uppercase opacity-60">Report Compiler: {agents.find(a => a.id === activeReportTab)?.role}</span>
                            <span className="text-emerald-700 bg-emerald-50 px-1.5 border border-emerald-300 font-bold uppercase">SECURED</span>
                          </div>

                          {state.agentMessages
                            .filter((m) => m.agentId === activeReportTab && m.type === "output")
                            .map((m) => (
                              <div key={m.id} className="mb-4 last:mb-0">
                                {renderMarkdown(m.message)}
                              </div>
                            ))
                          }
                        </div>
                      )}

                    </div>
                  </div>

                  {/* Operational Expert Console Chat Form */}
                  <div className="p-3 border-t-2 border-[#141414] bg-white shrink-0">
                    <div className="flex items-center justify-between text-[10px] font-mono mb-1.5 opacity-80">
                      <span className="flex items-center gap-1">
                        💬 Individual Expert Prompt: 
                        <select 
                          value={chatSelectedAgent}
                          onChange={(e) => setChatSelectedAgent(e.target.value)}
                          className="bg-[#E4E3E0] text-[#141414] border border-[#141414] text-[10px] font-mono px-1 py-0.5 rounded-none font-bold"
                          id="select-chat-agent"
                        >
                          {agents.map(a => (
                            <option key={a.id} value={a.id}>@{a.name}</option>
                          ))}
                        </select>
                      </span>
                      <span className="text-[9px] tracking-tighter opacity-70">Ask about scripts, math models or fixes</span>
                    </div>

                    <form onSubmit={sendChatMessage} className="flex gap-2">
                      <input
                        type="text"
                        value={chatMessage}
                        onChange={(e) => setChatMessage(e.target.value)}
                        placeholder={`Directly ask @${agents.find(a => a.id === chatSelectedAgent)?.name} custom queries...`}
                        className="flex-1 px-3 py-1.5 bg-[#E4E3E0]/30 border-2 border-[#141414] text-xs font-mono placeholder-slate-400 focus:outline-none focus:bg-white"
                        id="chat-input-query"
                      />
                      <button
                        type="submit"
                        className="px-4 bg-[#141414] text-white hover:bg-slate-700 font-bold uppercase text-[10px] font-mono flex items-center gap-1 border border-transparent transition-all active:scale-95"
                        id="chat-btn-send"
                      >
                        <Send className="h-3 w-3" /> SUBMIT
                      </button>
                    </form>

                    {/* Quick interactive historical display of chats if any */}
                    {chatHistory.length > 0 && (
                      <div className="mt-2 max-h-24 overflow-y-auto border border-[#141414]/15 bg-[#fafaf8] p-1.5 text-[9.5px] font-mono space-y-1 rounded-none">
                        {chatHistory.map((h, idx) => (
                          <div key={idx} className={h.isAgent ? "text-[#141414]" : "text-slate-500"}>
                            <b className="font-extrabold">[{h.sender}]</b>: {h.message.slice(0, 100)}{h.message.length > 100 ? "..." : ""}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                </div>

              </div>

            </div>

            {/* BASE INFRASTRUCTURE STATUS FOOTER */}
            <footer className="h-10 border-t-4 border-[#141414] bg-[#141414] text-[#E4E3E0] flex items-center justify-between px-4 sm:px-6 shrink-0 text-[10px] font-mono">
              <div className="flex gap-4 sm:gap-6 items-center text-[9px] uppercase tracking-tighter">
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> 
                  Worker Pipeline: ACTIVE
                </span>
                <span className="opacity-40">|</span>
                <span>Active Model: XGBoost-Churn-Predictor:v3.2</span>
                <span className="opacity-40 hidden sm:inline">|</span>
                <span className="hidden sm:inline">CUDA Compute Allocation: cuda:0 (GTX 4090 Core)</span>
              </div>
              <div className="flex gap-4 text-[9px] font-mono">
                <span className="bg-[#E4E3E0] text-[#141414] px-1.5 font-bold uppercase text-[8.5px]">ADMIN ACCESS MODE</span>
              </div>
            </footer>

          </main>
          
        </div>

      </div>

    </div>
  );
}
