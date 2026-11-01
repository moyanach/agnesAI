const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  // ─── 文件系统与工作区 ──────────────────────────────
  showInFolder: (filePath) => ipcRenderer.send("show-in-folder", filePath),
  selectSaveDirectory: () => ipcRenderer.invoke("select-save-directory"),
  dialogSelectWorkDirectory: () => ipcRenderer.invoke("dialog-select-work-directory"),
  getConfig: (key) => ipcRenderer.invoke("get-config", key),
  setConfig: (key, value) => ipcRenderer.invoke("set-config", key, value),

  // ─── 模型配置 ──────────────────────────────────────
  dbGetModels: () => ipcRenderer.invoke("db-get-models"),
  dbAddModel: (model) => ipcRenderer.invoke("db-add-model", model),
  dbDeleteModel: (id) => ipcRenderer.invoke("db-delete-model", id),
  apiGetModels: () => ipcRenderer.invoke("api-get-models"),

  // ─── 会话与消息管理 ────────────────────────────────
  dbGetSessions: () => ipcRenderer.invoke("db-get-sessions"),
  dbAddSession: (session) => ipcRenderer.invoke("db-add-session", session),
  dbUpdateSessionTitle: (id, title) => ipcRenderer.invoke("db-update-session-title", id, title),
  dbDeleteSession: (id) => ipcRenderer.invoke("db-delete-session", id),
  dbGetSessionWorkDir: (id) => ipcRenderer.invoke("db-get-session-work-dir", id),
  dbUpdateSessionWorkDir: (id, workDir) => ipcRenderer.invoke("db-update-session-work-dir", id, workDir),
  dbGetMessages: (sessionId) => ipcRenderer.invoke("db-get-messages", sessionId),
  dbAddMessage: (message) => ipcRenderer.invoke("db-add-message", message),
  dbDeleteMessagesAfter: (sessionId, timestamp) =>
    ipcRenderer.invoke("db-delete-messages-after", { sessionId, timestamp }),

  // ─── Agent 扩展与 Inspector 监控 ────────────────────
  getMcpServers: (workDir) => ipcRenderer.invoke("get-mcp-servers", workDir),
  saveMcpServers: (servers) => ipcRenderer.invoke("save-mcp-servers", servers),
  getSkills: (workDir) => ipcRenderer.invoke("get-skills", workDir),
  getMemories: (workDir) => ipcRenderer.invoke("get-memories", workDir),
  getSessionOutputs: (sessionId) => ipcRenderer.invoke("get-session-outputs", sessionId),
  getContextMetrics: (params) => ipcRenderer.invoke("get-context-metrics", params),
  getWorkspaceGitStatus: (workDir) => ipcRenderer.invoke("get-workspace-git-status", workDir),
  getRecentProjects: () => ipcRenderer.invoke("get-recent-projects"),
  addRecentProject: (proj) => ipcRenderer.invoke("add-recent-project", proj),

  // ─── 工具调用 ──────────────────────────────────────
  getTools: () => ipcRenderer.invoke("get-tools"),
  executeTool: (name, args) => ipcRenderer.invoke("execute-tool", { name, args }),

  // ─── 流式 Agent 调用 ───────────────────────────────
  streamChat: (
    sessionId,
    messages,
    model,
    enableTools,
    onData,
    onEnd,
    onError,
    onToolStatus,
    onContextMetrics,
    onOutputsUpdated
  ) => {
    const dataChannel = `chat-stream-data-${sessionId}`;
    const endChannel = `chat-stream-end-${sessionId}`;
    const errorChannel = `chat-stream-error-${sessionId}`;
    const toolStatusChannel = `chat-stream-tool-status-${sessionId}`;
    const metricsChannel = `chat-stream-context-metrics-${sessionId}`;
    const outputsChannel = `session-outputs-updated-${sessionId}`;

    let isCleanedUp = false;

    const cleanup = () => {
      if (isCleanedUp) return;
      isCleanedUp = true;
      ipcRenderer.removeListener(dataChannel, dataHandler);
      ipcRenderer.removeListener(endChannel, endHandler);
      ipcRenderer.removeListener(errorChannel, errorHandler);
      ipcRenderer.removeListener(toolStatusChannel, toolStatusHandler);
      ipcRenderer.removeListener(metricsChannel, metricsHandler);
      ipcRenderer.removeListener(outputsChannel, outputsHandler);
    };

    const dataHandler = (e, data) => onData(data);
    const endHandler = (e, args) => {
      cleanup();
      onEnd(args ? args.metadata : null);
    };
    const errorHandler = (e, err) => {
      cleanup();
      onError(err);
    };
    const toolStatusHandler = (e, statusData) => {
      if (onToolStatus) onToolStatus(statusData);
    };
    const metricsHandler = (e, metrics) => {
      if (onContextMetrics) onContextMetrics(metrics);
    };
    const outputsHandler = () => {
      if (onOutputsUpdated) onOutputsUpdated();
    };

    ipcRenderer.on(toolStatusChannel, toolStatusHandler);
    ipcRenderer.on(dataChannel, dataHandler);
    ipcRenderer.on(metricsChannel, metricsHandler);
    ipcRenderer.on(outputsChannel, outputsHandler);
    ipcRenderer.once(endChannel, endHandler);
    ipcRenderer.once(errorChannel, errorHandler);

    // 触发主进程的流式 Agent 请求
    ipcRenderer.send("chat-request", { sessionId, messages, model, enableTools });
  },
});
