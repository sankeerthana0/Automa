export interface SystemMetrics {
  cpu: number;
  memory: number; // in MB or %
  gpu: number;
  requestCount: number;
  apiLatency: number; // in ms
  apiErrorRate: number; // in %
  modelAccuracy: number; // in %
  modelConfidence: number; // in %
  f1Score: number; // in %
  inputDriftScore: number; // Kolmogorov-Smirnov static or similar, 0 to 1
  dockerStatus: "healthy" | "degraded" | "failed";
}

export interface LogLine {
  id: string;
  timestamp: string;
  service: "api" | "worker" | "model-runtime" | "docker-daemon";
  level: "INFO" | "WARNING" | "ERROR" | "CRITICAL";
  message: string;
  payload?: string;
}

export interface Anomaly {
  id: string;
  name: string;
  type: "drift" | "exception" | "docker_crash" | "latency" | "none";
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  timestamp: string;
  resolved: boolean;
  logsTriggered: string[]; // log line IDs
}

export interface MLOpsAgent {
  id: string;
  name: string;
  role: string;
  description: string;
  status: "idle" | "investigating" | "running" | "done" | "failed";
  avatar: string;
  systemPrompt: string;
}

export interface AgentMessage {
  id: string;
  timestamp: string;
  agentId: string;
  type: "system" | "input" | "thought" | "output";
  message: string;
}

export interface SimulationState {
  metrics: SystemMetrics;
  history: {
    timestamps: string[];
    accuracy: number[];
    confidence: number[];
    latency: number[];
    drift: number[];
  };
  activeAnomalies: Anomaly[];
  logs: LogLine[];
  agentMessages: AgentMessage[];
}
