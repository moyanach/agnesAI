const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  // 文件系统操作
  showInFolder: (filePath) => ipcRenderer.send("show-in-folder", filePath),
  selectSaveDirectory: () => ipcRenderer.invoke("select-save-directory"),
  getConfig: (key) => ipcRenderer.invoke("get-config", key),
  setConfig: (key, value) => ipcRenderer.invoke("set-config", key, value),

  // 数据库读取与修改
  dbGetSessions: () => ipcRenderer.invoke("db-get-sessions"),
  dbAddSession: (session) => ipcRenderer.invoke("db-add-session", session),
  dbUpdateSessionTitle: (id, title) => ipcRenderer.invoke("db-update-session-title", id, title),
  dbDeleteSession: (id) => ipcRenderer.invoke("db-delete-session", id),
  dbGetMessages: (sessionId) => ipcRenderer.invoke("db-get-messages", sessionId),
  dbAddMessage: (message) => ipcRenderer.invoke("db-add-message", message),
  dbDeleteMessagesAfter: (sessionId, timestamp) => ipcRenderer.invoke("db-delete-messages-after", { sessionId, timestamp }),
  dbGetMediaTasks: (type) => ipcRenderer.invoke("db-get-media-tasks", type),
  dbDeleteMediaTask: (id) => ipcRenderer.invoke("db-delete-media-task", id),
  dbGetDashboardStats: () => ipcRenderer.invoke("db-get-dashboard-stats"),
  dbGetSessionWorkDir: (id) => ipcRenderer.invoke("db-get-session-work-dir", id),
  dbUpdateSessionWorkDir: (id, workDir) => ipcRenderer.invoke("db-update-session-work-dir", id, workDir),
  dialogSelectWorkDirectory: () => ipcRenderer.invoke("dialog-select-work-directory"),
  dbGetModels: () => ipcRenderer.invoke("db-get-models"),
  dbAddModel: (model) => ipcRenderer.invoke("db-add-model", model),
  dbDeleteModel: (id) => ipcRenderer.invoke("db-delete-model", id),

  // 接口请求
  apiGetModels: () => ipcRenderer.invoke("api-get-models"),
  apiGenerateImage: (params) => ipcRenderer.invoke("api-generate-image", params),
  apiGenerateVideo: (params) => ipcRenderer.invoke("api-generate-video", params),
  apiPollVideo: (taskId) => ipcRenderer.invoke("api-poll-video", taskId),

  // 工具注册表
  getTools: () => ipcRenderer.invoke("get-tools"),
  executeTool: (name, args) => ipcRenderer.invoke("execute-tool", { name, args }),

  // 真实流式 API 调用
  streamChat: (sessionId, messages, model, enableTools, onData, onEnd, onError, onToolStatus) => {
    const dataChannel = `chat-stream-data-${sessionId}`;
    const endChannel = `chat-stream-end-${sessionId}`;
    const errorChannel = `chat-stream-error-${sessionId}`;
    const toolStatusChannel = `chat-stream-tool-status-${sessionId}`;

    let isCleanedUp = false;

    const cleanup = () => {
      if (isCleanedUp) return;
      isCleanedUp = true;
      ipcRenderer.removeListener(dataChannel, dataHandler);
      ipcRenderer.removeListener(endChannel, endHandler);
      ipcRenderer.removeListener(errorChannel, errorHandler);
      ipcRenderer.removeListener(toolStatusChannel, toolStatusHandler);
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

    ipcRenderer.on(toolStatusChannel, toolStatusHandler);
    ipcRenderer.on(dataChannel, dataHandler);
    ipcRenderer.once(endChannel, endHandler);
    ipcRenderer.once(errorChannel, errorHandler);

    // 触发主进程的请求
    ipcRenderer.send("chat-request", { sessionId, messages, model, enableTools });
  },
});
