import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { SystemMetrics, LogLine, Anomaly, SimulationState, AgentMessage } from "./src/types.js";

// Load environment variables
dotenv.config();

const __filename = typeof import.meta !== "undefined" && import.meta.url ? fileURLToPath(import.meta.url) : "";
const __dirname = __filename ? path.dirname(__filename) : process.cwd();

// Initialize Gemini SDK with named parameters & user-agent headers
let aiClient: GoogleGenAI | null = null;
function getGemini(): GoogleGenAI | null {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (key) {
      aiClient = new GoogleGenAI({
        apiKey: key,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });
    }
  }
  return aiClient;
}

const app = express();
app.use(express.json());

const PORT = 3000;

// Current simulation memory store
let currentMetrics: SystemMetrics = {
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
};

// Simulation history queues
const history = {
  timestamps: Array.from({ length: 15 }, (_, i) => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - (15 - i) * 2);
    return d.toISOString();
  }),
  accuracy: [94.5, 94.1, 94.4, 94.0, 93.8, 94.2, 94.5, 94.1, 93.9, 94.3, 94.0, 94.2, 94.1, 94.3, 94.2],
  confidence: [89.0, 89.2, 89.1, 89.5, 88.8, 89.2, 89.4, 89.0, 89.5, 89.1, 89.7, 89.3, 89.4, 89.2, 89.5],
  latency: [42, 45, 48, 41, 46, 44, 43, 47, 45, 42, 49, 44, 42, 46, 45],
  drift: [0.06, 0.07, 0.05, 0.08, 0.06, 0.07, 0.09, 0.07, 0.12, 0.08, 0.06, 0.07, 0.09, 0.08, 0.08],
};

let anomalies: Anomaly[] = [];
let logs: LogLine[] = [];
let agentMessages: AgentMessage[] = [];

// Base logging helper
const addLogLine = (
  service: LogLine["service"],
  level: LogLine["level"],
  message: string,
  payload?: string
): LogLine => {
  const log: LogLine = {
    id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    timestamp: new Date().toISOString(),
    service,
    level,
    message,
    payload,
  };
  logs.push(log);
  if (logs.length > 100) {
    logs.shift();
  }
  return log;
};

// Seed log history with normal runtime data
const seedLogs = () => {
  addLogLine("docker-daemon", "INFO", "Verified local image tag: ml-predictor:v3.2.0");
  addLogLine("docker-daemon", "INFO", "Spinning up container mlops-api-runtime running Python 3.10.12");
  addLogLine("docker-daemon", "INFO", "Mounting model checkpoints volume /opt/models/churn-prediction");
  addLogLine("model-runtime", "INFO", "Loading pre-trained churn xgboost weights checkpoint churn_v3.2_final.bin");
  addLogLine("model-runtime", "INFO", "Model initialization successful. CUDA devices mapped: [cuda:0]. Warm startup complete.");
  addLogLine("api", "INFO", "FastAPI app started on host 0.0.0.0, port 8000");
  addLogLine("api", "INFO", "Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)");
  addLogLine("api", "INFO", "GET /metrics 200 OK - 15.4ms");
  addLogLine("api", "INFO", "POST /v1/predictions 200 OK - batch size 100 - latency 42.1ms");
  addLogLine("worker", "INFO", "Background logger initialized to forward logs to Datadog/Splunk agent at port 12201");
};
seedLogs();

// Advance state simulation loop (simulate background traffic fluctuating)
setInterval(() => {
  if (anomalies.length > 0 && anomalies.some((a) => !a.resolved)) {
    // Under active anomalies, metrics stay degraded
    const active = anomalies.find((a) => !a.resolved)!;
    if (active.type === "drift") {
      currentMetrics.modelAccuracy = Math.max(65, currentMetrics.modelAccuracy * 0.995 + Math.random() * 0.3 - 0.2);
      currentMetrics.modelConfidence = Math.max(50, currentMetrics.modelConfidence * 0.996 + Math.random() * 0.2 - 0.25);
      currentMetrics.inputDriftScore = Math.min(0.95, currentMetrics.inputDriftScore * 1.05 + 0.02);
      currentMetrics.cpu = Math.min(95, 45 + Math.random() * 10);
      if (Math.random() > 0.6) {
        addLogLine("model-runtime", "WARNING", `Input covariate statistical drift in progress. Drift metric (KS): ${currentMetrics.inputDriftScore.toFixed(3)} exceeding threshold 0.20`);
      }
    } else if (active.type === "exception") {
      currentMetrics.apiErrorRate = Math.min(45, currentMetrics.apiErrorRate + Math.random() * 5 + 1);
      currentMetrics.apiLatency = Math.min(500, currentMetrics.apiLatency + Math.random() * 50);
      if (Math.random() > 0.5) {
        addLogLine("api", "ERROR", "Exception trace caught: ValueError mismatch training features shape (1, 18). Incoming has shape (1, 14)");
      }
    } else if (active.type === "docker_crash") {
      currentMetrics.dockerStatus = "failed";
      currentMetrics.requestCount = Math.max(0, currentMetrics.requestCount - 40);
      currentMetrics.apiErrorRate = 100;
      currentMetrics.cpu = 99;
      currentMetrics.memory = 98;
      if (Math.random() > 0.4) {
        addLogLine("docker-daemon", "CRITICAL", "Container physical OOM - supervisor triggered state 139 (SIGSEGV). Physical memory buffer exceeded limits.");
      }
    } else if (active.type === "latency") {
      currentMetrics.apiLatency = Math.min(2500, currentMetrics.apiLatency + Math.random() * 200 + 50);
      currentMetrics.apiErrorRate = Math.min(15, currentMetrics.apiErrorRate + Math.random() * 0.4);
      if (Math.random() > 0.6) {
        addLogLine("api", "WARNING", `Database connections count: 50/50 pool saturated. Active pool size: 50. Waiting in queue: ${Math.floor(Math.random() * 80)}`);
      }
    }
  } else {
    // Normal small fluctuations
    currentMetrics.cpu = Math.max(10, Math.min(90, currentMetrics.cpu + Math.random() * 4 - 2));
    currentMetrics.memory = Math.max(30, Math.min(70, currentMetrics.memory + Math.random() * 2 - 1));
    currentMetrics.gpu = Math.max(5, Math.min(80, currentMetrics.gpu + Math.random() * 2 - 0.8));
    currentMetrics.requestCount = Math.max(100, Math.min(600, currentMetrics.requestCount + Math.floor(Math.random() * 20 - 10)));
    currentMetrics.apiLatency = Math.max(20, Math.min(120, currentMetrics.apiLatency + Math.random() * 6 - 3));
    currentMetrics.apiErrorRate = Math.max(0, Math.min(5, currentMetrics.apiErrorRate + Math.random() * 0.1 - 0.05));
    currentMetrics.modelAccuracy = Math.max(90, Math.min(98, currentMetrics.modelAccuracy + Math.random() * 0.2 - 0.1));
    currentMetrics.modelConfidence = Math.max(85, Math.min(95, currentMetrics.modelConfidence + Math.random() * 0.1 - 0.05));
    currentMetrics.f1Score = Math.max(91, Math.min(97, currentMetrics.modelAccuracy * 0.99 + Math.random() * 0.1));
    currentMetrics.inputDriftScore = Math.max(0.01, Math.min(0.15, currentMetrics.inputDriftScore + Math.random() * 0.01 - 0.005));
    currentMetrics.dockerStatus = "healthy";

    if (Math.random() > 0.85) {
      addLogLine("api", "INFO", `GET /v1/predictions 200 OK - batch size 1 - latency ${currentMetrics.apiLatency.toFixed(1)}ms`);
    }
  }

  // Push history queues
  const now = new Date().toISOString();
  history.timestamps.push(now);
  history.accuracy.push(currentMetrics.modelAccuracy);
  history.confidence.push(currentMetrics.modelConfidence);
  history.latency.push(currentMetrics.apiLatency);
  history.drift.push(currentMetrics.inputDriftScore);

  if (history.timestamps.length > 20) {
    history.timestamps.shift();
    history.accuracy.shift();
    history.confidence.shift();
    history.latency.shift();
    history.drift.shift();
  }
}, 5000);

// API Endpoints

app.get("/api/state", (req, res) => {
  res.json({
    metrics: currentMetrics,
    history,
    activeAnomalies: anomalies,
    logs,
    agentMessages,
  });
});

app.post("/api/inject-anomaly", (req, res) => {
  const { type, severity, description, name } = req.body;

  // Clear existing active non-resolved anomalies first to simulate clear scenarios
  anomalies = anomalies.map((a) => ({ ...a, resolved: true }));

  const id = `anom-${Date.now()}`;
  const triggeredLogIds: string[] = [];

  if (type === "drift") {
    currentMetrics.inputDriftScore = 0.45;
    currentMetrics.modelAccuracy = 82.5;
    currentMetrics.modelConfidence = 74.0;
    const l1 = addLogLine("model-runtime", "WARNING", "Inference quality baseline breached. ShiftDetected: true. Drifting features detected in raw incoming stream.", '{"feature_drift": {"device_os_android": 0.42, "user_age": 0.51}, "ks_p_value_threshold": 0.01}');
    const l2 = addLogLine("model-runtime", "WARNING", "Input Covariate Drift indicator passed critical threshold of 0.20 (Current: 0.45)", '{"drift_metrics": {"overall": 0.45, "embedding_cosine_distance": 0.38}}');
    const l3 = addLogLine("api", "INFO", "Prediction served successfully but with degraded output classification score confidence bounds (Under 65%)");
    triggeredLogIds.push(l1.id, l2.id, l3.id);
  } else if (type === "exception") {
    currentMetrics.apiErrorRate = 18.2;
    currentMetrics.apiLatency = 135;
    const l1 = addLogLine("api", "ERROR", "FastAPI post /v1/predictions inference pipeline crash.", `Traceback (most recent call last):
  File "/app/pipelines/inference.py", line 47, in predict
    scaled_features = self.scaler.transform(raw_features)
  File "/usr/local/lib/python3.10/site-packages/sklearn/preprocessing/_data.py", line 964, in transform
    X = self._validate_data(X, reset=False, accept_sparse='csr')
ValueError: Selected features shape (1, 14) mismatch with training features shape (1, 18). Missing features: ['device_locale_scaled', 'user_session_depth_idx', 'geo_location_cluster', 'engagement_frequency_std']`);
    const l2 = addLogLine("worker", "ERROR", "Worker queue failed processing message prediction_job_81239 - payload missing client schema variables: 'device_locale_scaled', 'user_session_depth_idx'");
    triggeredLogIds.push(l1.id, l2.id);
  } else if (type === "docker_crash") {
    currentMetrics.dockerStatus = "failed";
    currentMetrics.cpu = 99;
    currentMetrics.memory = 99;
    currentMetrics.apiErrorRate = 100;
    currentMetrics.requestCount = 0;
    const l1 = addLogLine("docker-daemon", "CRITICAL", "Physical memory limits allocation overfilled! Container mlops-api-runtime exited abnormally with signal SIGSEGV");
    const l2 = addLogLine("docker-daemon", "CRITICAL", "PyTorch CUDA dynamic memory leaks. CUDA Out Of Memory. Attempting reallocation of cached tensors on Device [cuda:0]. Failed to allocate 1.25 GB memory.", '{"allocated": "3.8GB", "free": "0.19GB", "requested": "1.25GB"}');
    const l3 = addLogLine("docker-daemon", "INFO", "Reboot sequence initiated: attempting port 8000 listener check. Socket binding failed with exit code 98 in container mlops-api-runtime: address already in use.");
    triggeredLogIds.push(l1.id, l2.id, l3.id);
  } else if (type === "latency") {
    currentMetrics.apiLatency = 1250;
    currentMetrics.apiErrorRate = 8.5;
    const l1 = addLogLine("api", "WARNING", "GET /v1/predictions threshold benchmark warning. Inference took 1250ms exceeding max constraint limits (200ms)");
    const l2 = addLogLine("worker", "WARNING", "Database pool latency threshold is high. PostgreSQL active connections 50/50. Waiting in query queue for over 950ms.");
    const l3 = addLogLine("api", "INFO", "Redis cache pool connection timeout. Redis host 'mlops-cache:6379' unreachable, switching to disk caching cascade.");
    triggeredLogIds.push(l1.id, l2.id, l3.id);
  }

  const anomaly: Anomaly = {
    id,
    name: name || "System Alert",
    type,
    severity,
    description,
    timestamp: new Date().toISOString(),
    resolved: false,
    logsTriggered: triggeredLogIds,
  };

  anomalies.push(anomaly);
  res.json({ message: "Anomaly injected successfully", anomaly });
});

app.post("/api/resolve-anomalies", (req, res) => {
  anomalies = anomalies.map((a) => ({ ...a, resolved: true }));
  currentMetrics.dockerStatus = "healthy";
  currentMetrics.modelAccuracy = 94.5;
  currentMetrics.modelConfidence = 89.2;
  currentMetrics.inputDriftScore = 0.07;
  currentMetrics.apiErrorRate = 0.05;
  currentMetrics.apiLatency = 45;
  addLogLine("docker-daemon", "INFO", "Manual mitigation action taken. System returned to fully operational parameters via container restart & cache purge.");
  res.json({ message: "All system anomalies resolved" });
});

// Clear Agent chat history
app.post("/api/agent/clear", (req, res) => {
  agentMessages = [];
  res.json({ message: "Agent console logs cleared" });
});

// Interactive Multi-Agent Diagnostics Trigger
app.post("/api/agent/trigger", async (req, res) => {
  const { debug } = req.body;
  const gemini = getGemini();

  const activeAnomaly = anomalies.find((a) => !a.resolved);
  if (!activeAnomaly) {
    return res.json({
      status: "no_active_anomaly",
      messages: [{
        id: `sys-${Date.now()}`,
        timestamp: new Date().toISOString(),
        agentId: "orchestator",
        type: "output",
        message: "No current anomaly detected in log telemetry. All systems green."
      }]
    });
  }

  // Find associated log lines
  const anomalyLogs = logs
    .filter((l) => activeAnomaly.logsTriggered.includes(l.id) || l.level === "ERROR" || l.level === "CRITICAL" || l.level === "WARNING")
    .map((l) => `[${l.timestamp}] [${l.service}] [${l.level}] ${l.message} ${l.payload ? `Payload: ${l.payload}` : ""}`)
    .join("\n");

  const systemSummary = `
  Active Anomaly Type: ${activeAnomaly.type}
  Severity: ${activeAnomaly.severity}
  Description: ${activeAnomaly.description}
  Metrics State: 
    - Accuracy: ${currentMetrics.modelAccuracy.toFixed(1)}%
    - Prediction Confidence: ${currentMetrics.modelConfidence.toFixed(1)}%
    - Input Drift Score (KS): ${currentMetrics.inputDriftScore.toFixed(2)}
    - API Error Rate: ${currentMetrics.apiErrorRate.toFixed(1)}%
    - API Latency: ${currentMetrics.apiLatency}ms
    - Docker daemon state: ${currentMetrics.dockerStatus}
  `;

  const newMessages: AgentMessage[] = [];

  const addAgentMsg = (agentId: string, type: AgentMessage["type"], message: string) => {
    const msg: AgentMessage = {
      id: `agent-msg-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      timestamp: new Date().toISOString(),
      agentId,
      type,
      message,
    };
    agentMessages.push(msg);
    newMessages.push(msg);
  };

  // Step 1: Log Analysis Agent evaluates
  addAgentMsg("log-analyzer", "thought", "Reading system exception logs and error vectors. Running traceback correlation regex on Python modules...");
  
  let logAnalysisOutput = "";
  if (gemini) {
    try {
      const resp = await gemini.models.generateContent({
        model: "gemini-3.5-flash",
        contents: `You are the Log Analysis Agent in an automated MLOps framework. 
Analyze these logs and diagnosis data for a deployed ML model system. Identify what Python exception, memory/host error, or Docker issue occurred, the root cause, and where in the code/deployment the problem is located.
Keep your analysis extremely clear, professional, direct, and formatted in markdown.

System context:
${systemSummary}

Relevant Log Streams:
${anomalyLogs}

Provide your evaluation containing:
1. Symptoms & Error Details
2. Primary Root Cause
3. Exact Code/Module File path mapped
4. Immediate code-level patch suggestion.`,
      });
      logAnalysisOutput = resp.text || "Failed to analyze.";
    } catch (e: any) {
      logAnalysisOutput = `Error executing analysis call: ${e.message}`;
    }
  } else {
    // Elegant system rule-based response when Gemini key is not configured yet
    if (activeAnomaly.type === "exception") {
      logAnalysisOutput = `### Log Analysis Agent Resolution
**Symptoms**: Value Error on input feature dimensions.
**Root Cause**: Pipeline expected 18 preprocessed input parameters but received only 14 parameters, likely because a Client-side SDK deployed an updated payload template without coordinate scaling.
**Tracked File**: \`/app/pipelines/inference.py\` around line 47 in \`predict()\`.
**Suggested Patch**:
\`\`\`python
# Add schema fallback inside inference.py
def validate_input(features):
    required = ['device_locale_scaled', 'user_session_depth_idx', 'geo_location_cluster', 'engagement_frequency_std']
    for f in required:
        if f not in featuresMap:
            featuresMap[f] = 0.0 # Assign baseline default fallback value to prevent model dimension mismatch
\`\`\``;
    } else if (activeAnomaly.type === "drift") {
      logAnalysisOutput = `### Log Analysis Agent Evaluation
**Symptoms**: Input Covariate Drift indicator crossed limit parameters.
**Root Cause**: Feature distribution mapping exhibits massive population mismatch over covariate dimensions (android split vs training indices). Logs suggest shift in feature weight distributions.
**Tracked File**: \`/app/pipelines/data_ingest.py\`.
**Suggested Patch**: Alert retraining worker pipeline or spin down inference service weights container to previous image checkpoint.`;
    } else if (activeAnomaly.type === "docker_crash") {
      logAnalysisOutput = `### Log Analysis Agent Diagnosis
**Symptoms**: SIGSEGV Out Of Memory exit code 139.
**Root Cause**: PyTorch CUDA caching allocator memory fragmentation during hyperparameter loading. Memory reservation limits surpassed Docker allocate parameters of 4GB.
**Tracked File**: \`/Dockerfile\` and \`docker-compose.yml\` configuration variables.
**Suggested Patch**: Insert \`PYTORCH_CUDA_ALLOC_CONF=max_split_size_mb:128\` in container environment constraints.`;
    } else {
      logAnalysisOutput = `### Log Analysis Agent Diagnosis
**Symptoms**: DB pools and response pipelines latency breach.
**Root Cause**: Database connections pool leak in connection lifecycle management.
**Tracked File**: \`/app/database/connection.py\`.`;
    }
  }
  addAgentMsg("log-analyzer", "output", logAnalysisOutput);

  // Step 2: Model Quality Agent evaluates
  addAgentMsg("model-quality", "thought", "Mapping accuracy curve regressions. Correlating prediction confidence metrics against feature tracking metadata...");
  let modelQualityOutput = "";
  if (gemini) {
    try {
      const resp = await gemini.models.generateContent({
        model: "gemini-3.5-flash",
        contents: `You are the Model Quality Agent in an automated MLOps framework. 
Review the model accuracy degradation or drift metrics of the ML system.
Keep it direct, professional, and formatted in markdown.

System metrics context:
${systemSummary}

Relevant Log Streams:
${anomalyLogs}

Provide a diagnostic assessment of the ML quality impact:
1. Severity of accuracy/F1-score drop
2. Feature Drift Evaluation (OOD assessment)
3. Confidence Interval degrade analysis
4. Preventive recommendations (e.g., automated retraining triggers, model fallbacks, or feature stores normalization).`,
      });
      modelQualityOutput = resp.text || "Failed to analyze model quality.";
    } catch (e: any) {
      modelQualityOutput = `Model Quality evaluation error: ${e.message}`;
    }
  } else {
    if (activeAnomaly.type === "drift") {
      modelQualityOutput = `### Model Quality Agent Quality Report
**Severity Rating**: **Critical (Red Alert)**
- **Historical Baseline**: Accuracy ~94.2%, Confidence ~89.5%
- **Current Metric**: Accuracy **${currentMetrics.modelAccuracy.toFixed(1)}%**, Confidence **${currentMetrics.modelConfidence.toFixed(1)}%**
- **Drift Mismatch Score**: **${currentMetrics.inputDriftScore.toFixed(2)}** (KS boundary > 0.20 trigger point)

**Analysis**:
The system is suffering from substantial covariate feature drift. This indicates the online production environment has received inputs that diverge drastically from the feature distribution present in the model's training corpus (e.g. android demographic expansion spike). 

**Mitigation Steps**:
- Trigger immediate auto-retraining pipeline container with the freshly accumulated data records.
- Apply high-confidence fallbacks or heuristic base models until F1 scores bounds stabilize.`;
    } else {
      modelQualityOutput = `### Model Quality Agent Report
**Severity Rating**: **Medium (Degraded Service)**
- Model performance metrics metrics have slightly degraded due to container starvation and API exception failures interrupting the prediction stream.
- Latency peaks to ${currentMetrics.apiLatency}ms are causing pipeline queues to drop batches resulting in zero F1 metrics resolution.`;
    }
  }
  addAgentMsg("model-quality", "output", modelQualityOutput);

  // Step 3: Deployment Agent evaluates Dockerfile, environments
  addAgentMsg("deployment", "thought", "Reviewing deployment specifications, port mappings, and container memory limits...");
  let deploymentOutput = "";
  if (gemini) {
    try {
      const resp = await gemini.models.generateContent({
        model: "gemini-3.5-flash",
        contents: `You are the Deployment Agent in an MLOps orchestrator framework.
Analyze the system failure and suggest system-level production changes regarding Docker configuration, API setup (FastAPI/Gunicorn), container limits, or memory management.
Keep it short, directly actionable, and formatted in markdown with actual code snippets (like docker-compose.yml, Dockerfile, or system commands).

System context:
${systemSummary}

Write a recommendation comprising:
1. Docker Container Status Diagnostic
2. Resource Tuning (Memory limits, Thread Pools, or Port assignments)
3. Actionable Config file modifications.`,
      });
      deploymentOutput = resp.text || "Failed to analyze deployment parameters.";
    } catch (e: any) {
      deploymentOutput = `Deployment agent diagnostics error: ${e.message}`;
    }
  } else {
    deploymentOutput = `### Deployment Agent Infrastructure Advisory
**Docker State Status**: **${currentMetrics.dockerStatus.toUpperCase()}**

For Python-based ML services running in container environments, we recommend tuning your deployment configurations:

1. **Memory Allocation**:
   Set explicit RAM limits in your \`docker-compose.yml\` to prevent Docker or Kubernetes from killing python workers silently via OOM score limiters.

2. **Actionable Service Patch**:
   Incorporate these environment configurations inside your \`docker-compose.yml\` or Helm values file:
   \`\`\`yaml
   services:
     ml-inference-api:
       image: ml-predictor:v3.2.0
       deploy:
         resources:
           limits:
             cpus: '2.00'
             memory: 8G
           reservations:
             devices:
               - driver: nvidia
                 count: all
                 capabilities: [gpu]
       environment:
         - PYTORCH_CUDA_ALLOC_CONF=max_split_size_mb:128
         - WEB_CONCURRENCY=2   # Tuned worker threads for concurrent rest api throughput
         - OMP_NUM_THREADS=2   # Prevent linear scaling thread thrashing
   \`\`\``;
  }
  addAgentMsg("deployment", "output", deploymentOutput);

  // Step 4: Documentation Agent generates a markdown runbook
  addAgentMsg("documentation", "thought", "Constructing production operational runbook and disaster recovery manual templates based on active agent diagnoses...");
  let documentationOutput = "";
  if (gemini) {
    try {
      const resp = await gemini.models.generateContent({
        model: "gemini-3.5-flash",
        contents: `You are the Documentation Agent in an MLOps systems framework. 
Construct a neat, thorough developer/operator Runbook to diagnose and remediate this exact issue in production.
Keep your response strictly Markdown.

Diagnoses gathered:
- Log Analyst: ${logAnalysisOutput}
- Model Quality: ${modelQualityOutput}
- Deployment: ${deploymentOutput}

Structure your runbook as:
- **Title**: RUNBOOK-MLOPS-${activeAnomaly.type.toUpperCase()}
- **Classification**: Incident Runbook (Severity ${activeAnomaly.severity})
- **Quick Remediation Checklist**
- **Verification Commands** (such as docker logs, testing api curls, checking dataset schemas or drift charts via pandas)
- **Rollback Process**
- **Incident Code References**`,
      });
      documentationOutput = resp.text || "Failed to generate runbook.";
    } catch (e: any) {
      documentationOutput = `Documentation generation failed: ${e.message}`;
    }
  } else {
    documentationOutput = `### RUNBOOK-MLOPS-${activeAnomaly.type.toUpperCase()}
**Classification**: Production Incident Runbook (Severity: ${activeAnomaly.severity.toUpperCase()})

#### Quick Remediation Steps
1. **Drain/Pause Live Traffic**: Gracefully route incoming REST API traffic to secondary failover replica clusters.
2. **Retrieve Stacktrace**: Grab container outputs \`docker logs ml-inference-container -n 120\`.
3. **Execute Clean Reboot**: Restart uvicorn with temporary environmental flag adjustments.
4. **Initiate Verification Checks**: Run curl endpoint diagnostics.

#### Diagnostic Verification Snippets
\`\`\`bash
# 1. Fetch live container parameters and resource consumption
docker stats mlops-api-runtime

# 2. Query FastAPI inference endpoint health
curl -X GET "http://localhost:3000/api/health" -H "accept: application/json"

# 3. Check GPU CUDA metrics inside container
docker exec -it ml-inference-service nvidia-smi
\`\`\`

#### Rollback Roll-Out Playbook
If diagnostic validation checks fail, revert container tags to \`v3.1.8-stable\` immediately using:
\`\`\`bash
docker-compose pull ml-inference-api:v3.1.8-stable
docker-compose up -d --no-deps ml-inference-api
\`\`\``;
  }
  addAgentMsg("documentation", "output", documentationOutput);

  // Step 5: Incident Summarizer Agent compiles a final Incident Post-Mortem summary
  addAgentMsg("summarizer", "thought", "Ingesting timelines, severity levels, diagnostic logs, and and developer manuals. Summarizing RCA executive incident report...");
  let rootCauseReport = "";
  if (gemini) {
    try {
      const resp = await gemini.models.generateContent({
        model: "gemini-3.5-flash",
        contents: `You are the Incident Summarizer Agent in an automated MLOps framework.
Compile a detailed Executive Incident Post-Mortem (Root Cause Analysis - RCA) based on this system failure.
Keep the style of your summary highly professional, objective, formatted in markdown.

Problem description: ${activeAnomaly.description}
Incident Details:
${systemSummary}

Use the preceding diagnostics to compile:
1. Executive Summary & Impact Analysis
2. Timeline of Incident and Cascade Failures
3. Root Cause Analysis (RCA) Summary (including Docker, REST API Python code, and ML accuracy drift issues)
4. Key Action Items & Preventative Measures (with responsible teams, e.g. Data Science, Infra Ops, Dev/App Team)`.trim(),
      });
      rootCauseReport = resp.text || "Failed to create Incident report.";
    } catch (e: any) {
      rootCauseReport = `Incident summary report generation failed: ${e.message}`;
    }
  } else {
    rootCauseReport = `### INCIDENT POST-MORTEM (RCA-MLOPS-${Date.now().toString().slice(-4)})
**Status**: IN RECOVERY 
**Severity**: ${activeAnomaly.severity.toUpperCase()}
**Impact**: Deployed ML models degraded or service crashed. Unusable inference predictions serviced to users.

---

### 1. Executive Summary
An automated alert triggered because system metrics crossed critical thresholds at current log cycles. The production model served predictions with severe degradations or entered crash loops due to structural anomalies. Live pipeline workers and API threads experienced an automated service bottleneck.

### 2. Timeline of Cascade Failure
- **T - 0min**: Telemetry system detected anomalous operations.
- **T + 2min**: Log analysis agent captured traceback patterns pointing to a physical crash.
- **T + 3min**: Model Quality agent flagged accuracy falling below critical limits.
- **T + 5min**: Deployment Agent recommended Docker CPU/Memory limitations updates.
- **T + 7min**: Documentation runbook mapped for incident remediation.

### 3. Key Remediation Action Items
| Task Description | Responsible Team | Status |
|---|---|---|
| Implement missing features schema fallbacks | Data Science Team | In Progress |
| Modify Docker memory quotas inside compose config | Infra Ops | Pending |
| Add real-time drift telemetry alert triggers | MLOps Ops | In Progress |`;
  }
  addAgentMsg("summarizer", "output", rootCauseReport);

  res.json({
    status: "completed",
    messages: newMessages,
  });
});

// Interactive single agent chat/prompt
app.post("/api/agent/chat", async (req, res) => {
  const { agentId, userMessage } = req.body;
  const gemini = getGemini();

  const activeAnomaly = anomalies.find((a) => !a.resolved);

  const context = `
  You are the automated MLOps agent named: ${agentId}.
  Current MLOps simulation parameters:
  - Docker Status: ${currentMetrics.dockerStatus}
  - Model Accuracy: ${currentMetrics.modelAccuracy.toFixed(1)}%
  - Prediction Confidence: ${currentMetrics.modelConfidence.toFixed(1)}%
  - Input Drift KS: ${currentMetrics.inputDriftScore.toFixed(2)}
  - API Latency: ${currentMetrics.apiLatency}ms
  - API Error Rate: ${currentMetrics.apiErrorRate.toFixed(1)}%
  - Active Anomaly: ${activeAnomaly ? `${activeAnomaly.name} (${activeAnomaly.type})` : "None"}
  
  Provide a professional response behaving strictly as your role:
  - 'log-analyzer': Expert in analyzing Python logging metrics, traceback exception lines, Docker logs, and database errors.
  - 'model-quality': Expert in PyTorch, XGBoost, Scikit-Learn training validation, concept drift, feature distribution, confusion matrices, and precision-recall.
  - 'deployment': Systems architect expert in Docker containers, docker-compose, FastAPI, production Kubernetes nodes, network configurations, and CPU/GPU memory tuning.
  - 'documentation': Operational writer dedicated to developer runbooks, deployment onboarding guides, and API contracts.
  - 'summarizer': Master executive incident compiler who aggregates all logs and summaries into formal Post-Mortems and Root Cause Analysis.
  
  Respond in helpful markdown, focusing directly on developer questions! Give real code samples (Python, YAML, shell scripts) where appropriate.
  `;

  // Pre-seed agent thought
  const systemMsg: AgentMessage = {
    id: `agent-msg-${Date.now()}-sys`,
    timestamp: new Date().toISOString(),
    agentId,
    type: "thought",
    message: `Analyzing developer query for MLOps diagnostics lookup: "${userMessage}"...`,
  };
  agentMessages.push(systemMsg);

  let replyText = "";
  if (gemini) {
    try {
      const resp = await gemini.models.generateContent({
        model: "gemini-3.5-flash",
        contents: [
          { text: context },
          { text: `Developer: ${userMessage}` }
        ]
      });
      replyText = resp.text || "No reply generated.";
    } catch (error: any) {
      replyText = `Error calling Gemini model API: ${error.message}`;
    }
  } else {
    // Quality local simulation responses
    const replies: Record<string, string> = {
      "log-analyzer": `### Log Analyzer Agent
I have looked at your request regarding the traceback or logging structure. For Python MLOps systems, we recommend wrapping your predictions with a precise schema validation:

\`\`\`python
# Example FastAPI route with pydantic schema validation
from pydantic import BaseModel, Field
from typing import List, Optional

class InferencePayload(BaseModel):
    user_inputs: List[float] = Field(..., desc="Inference vectors")
    device_id: str
    locale: Optional[str] = "en_US" # safe default to omit dimension mismatches
\`\`\`
Let me know if you would like me to write a complete logging filter middleware for standard Python uvicorn servers!`,
      "model-quality": `### Model Quality Agent
Regarding accuracy degradation and statistical drift, the best approach is to compute the Jensen-Shannon Divergence or Kolmogorov-Smirnov test on incoming datasets relative to a static reference training corpus:

\`\`\`python
# Real-time KS drift testing on custom dataframes
from scipy.stats import ks_2samp

def check_feature_drift(training_series, serving_series, threshold=0.05):
    statistic, p_value = ks_2samp(training_series, serving_series)
    # If p_value is less than our threshold, features have drifted!
    return p_value < threshold, statistic
\`\`\`
Let me know if you need help designing an automated training-on-drift trigger pipeline.`,
      "deployment": `### Deployment Infrastructure Agent
To optimize Python workloads of ML inference, a typical Dockerfile setup for production should be multi-stage, rootless, and use specialized cache bindings for pip:

\`\`\`dockerfile
# production multi-stage ML Dockerfile
FROM python:3.10-slim as builder
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

FROM python:3.10-slim as runner
WORKDIR /app
COPY --from=builder /root/.local /root/.local
COPY . /app
ENV PATH=/root/.local/bin:$PATH
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
\`\`\``,
      "documentation": `### Documentation Agent
I'm ready to document any part of this architecture. I can compile:
- A REST API contract for \`/v1/predictions\` (with parameters, status response schemas, and latency charts).
- Onboarding script guides for new developers setting up Python ML workloads in Docker.
Tell me what documentation section to draft!`,
      "summarizer": `### Incident Summarizer Agent
I can compile any timeline or incident correlation summaries. If we encounter multiple failures, I will aggregate the Docker status, Python pipeline errors, accuracy drop, and network status to create a detailed post-mortem report. What metadata would you like to add to the incident history?`
    };

    replyText = replies[agentId] || `Agent ${agentId} is ready to consult on your task. Provide specific python/docker context to get detailed support.`;
  }

  const replyMsg: AgentMessage = {
    id: `agent-msg-${Date.now()}-reply`,
    timestamp: new Date().toISOString(),
    agentId,
    type: "output",
    message: replyText,
  };
  agentMessages.push(replyMsg);

  res.json({ reply: replyText, messages: [systemMsg, replyMsg] });
});

// Serve frontend assets in production or connect Vite dev server
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Listen to host 0.0.0.0 and port 3000 as required
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server starting on http://0.0.0.0:${PORT}`);
  });
}

startServer();
