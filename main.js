const {
  app,
  BrowserWindow,
  protocol,
  ipcMain,
  dialog,
  shell,
  net,
} = require("electron");
const path = require("path");
const fs = require("fs");
const { pathToFileURL } = require("url");
const crypto = require("crypto");

// 引入核心业务服务
const storageService = require("./services/storageService");
const { getWorkspaceGitStatus } = require("./services/workspaceGitService");
const { calculateContextMetrics } = require("./services/contextCalculator");
const { toolRegistry } = require("./utils/toolRegistry");
const { performWebSearch, scrapePageContent } = require("./utils/tools/webTools");

// 注册特权协议 (必须在 app.whenReady() 之前调用)
protocol.registerSchemesAsPrivileged([
  {
    scheme: "app",
    privileges: {
      standard: true,
      secure: true,
      bypassCSP: true,
      supportFetchAPI: true,
      stream: true,
    },
  },
  {
    scheme: "local-media",
    privileges: {
      standard: true,
      secure: true,
      bypassCSP: true,
      supportFetchAPI: true,
      stream: true,
    },
  },
]);

// 读取系统配置辅助函数
function getApiConfig() {
  const apiKey = storageService.getConfig("api_key") || "";
  const baseUrl = storageService.getConfig("base_url") || "https://api.openai.com/v1";
  const savePath = storageService.getConfig("save_path") || "";
  return { apiKey, baseUrl, savePath };
}

// 读取搜索配置辅助函数
function getSearchConfig() {
  const provider = storageService.getConfig("search_provider") || "duckduckgo";
  const apiKey = storageService.getConfig("search_api_key") || "";
  const maxResultsVal = storageService.getConfig("search_max_results") || 5;
  const maxResults = parseInt(maxResultsVal, 10) || 5;
  return { provider, apiKey, maxResults };
}

/**
 * 统一获取模型配置（优先匹配 models 列表，回退到全局配置）
 */
function getModelConfig(model, defaultModelId = "gpt-4o") {
  const models = storageService.getModels();
  const matched = models.find(
    (m) => m.id === model || m.model_id === model,
  );

  const globalCfg = getApiConfig();
  const modelBaseUrl = matched?.base_url || globalCfg.baseUrl;
  const modelApiKey = matched?.api_key || globalCfg.apiKey;
  const provider = matched?.provider || "openai";
  const apiModelId = matched?.model_id || model || defaultModelId;

  return { modelBaseUrl, modelApiKey, provider, apiModelId };
}

/**
 * 包装 IPC handler 的异常处理
 */
function safeHandler(fn) {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (err) {
      console.error("[main IPC Error]", err);
      throw err;
    }
  };
}

let mainWindow = null;

// 2. 创建主窗口
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1080,
    minHeight: 700,
    backgroundColor: "#111111",
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 16, y: 16 },
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: true,
    },
  });

  const isDev = !app.isPackaged && process.env.NODE_ENV === "development";
  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
  } else {
    mainWindow.loadURL("app://dist/index.html");
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// 3. 注册 IPC 事件与生命周期
app.whenReady().then(() => {
  // 3.1 初始化 ~/.agnes 配置文件与环境
  storageService.initStorage();

  // 3.2 注册特权协议
  protocol.handle("local-media", async (request) => {
    try {
      let filePath = request.url;
      if (filePath.startsWith("local-media://")) {
        filePath = filePath.slice("local-media://".length);
      }
      const queryIndex = filePath.indexOf("?");
      if (queryIndex !== -1) filePath = filePath.substring(0, queryIndex);
      const hashIndex = filePath.indexOf("#");
      if (hashIndex !== -1) filePath = filePath.substring(0, hashIndex);
      filePath = decodeURIComponent(filePath);

      if (process.platform === "win32") {
        if (filePath.startsWith("/")) filePath = filePath.slice(1);
        filePath = filePath.replace(/\//g, "\\");
      } else {
        if (!filePath.startsWith("/")) filePath = "/" + filePath;
      }

      const fileUrl = pathToFileURL(filePath).toString();
      const response = await net.fetch(fileUrl, { bypassCustomProtocolHandlers: true });
      const headers = new Headers(response.headers);
      headers.set("Access-Control-Allow-Origin", "*");

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    } catch (error) {
      console.error("Failed to load local file via local-media:", error);
      return new Response("File not found", { status: 404 });
    }
  });

  protocol.handle("app", async (request) => {
    const url = new URL(request.url);
    let filePath;
    if (url.host === "dist") {
      filePath = path.join(__dirname, "dist", decodeURIComponent(url.pathname));
    } else {
      filePath = path.join(__dirname, decodeURIComponent(url.pathname));
    }
    const fileUrl = pathToFileURL(filePath).toString();
    const response = await net.fetch(fileUrl, { bypassCustomProtocolHandlers: true });
    const headers = new Headers(response.headers);
    if (filePath.endsWith(".js") || filePath.endsWith(".mjs")) {
      headers.set("Content-Type", "text/javascript; charset=utf-8");
    } else if (filePath.endsWith(".css")) {
      headers.set("Content-Type", "text/css; charset=utf-8");
    }
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  });

  // --- 配置操作 IPC ---
  ipcMain.handle(
    "get-config",
    safeHandler((event, key) => storageService.getConfig(key))
  );

  ipcMain.handle(
    "set-config",
    safeHandler((event, key, value) => storageService.setConfig(key, value))
  );

  // --- 模型操作 IPC ---
  ipcMain.handle(
    "db-get-models",
    safeHandler(() => storageService.getModels())
  );

  ipcMain.handle(
    "db-add-model",
    safeHandler((event, model) => storageService.addModel(model))
  );

  ipcMain.handle(
    "db-delete-model",
    safeHandler((event, id) => storageService.deleteModel(id))
  );

  // --- 会话与消息操作 IPC ---
  ipcMain.handle(
    "db-get-sessions",
    safeHandler(() => storageService.getSessions())
  );

  ipcMain.handle(
    "db-add-session",
    safeHandler((event, session) => storageService.saveSession(session))
  );

  ipcMain.handle(
    "db-update-session-title",
    safeHandler((event, id, title) => {
      const session = storageService.getSessions().find((s) => s.id === id);
      if (session) {
        session.title = title;
        storageService.saveSession(session);
        return true;
      }
      return false;
    })
  );

  ipcMain.handle(
    "db-update-session-work-dir",
    safeHandler((event, id, workDir) => {
      const session = storageService.getSessions().find((s) => s.id === id);
      if (session) {
        session.work_dir = workDir || null;
        storageService.saveSession(session);
        return true;
      }
      return false;
    })
  );

  ipcMain.handle(
    "db-get-session-work-dir",
    safeHandler((event, id) => {
      const session = storageService.getSessions().find((s) => s.id === id);
      return session?.work_dir || null;
    })
  );

  ipcMain.handle(
    "dialog-select-work-directory",
    safeHandler(async () => {
      const result = await dialog.showOpenDialog(mainWindow, {
        properties: ["openDirectory"],
        title: "选择项目工作目录",
      });
      if (result.canceled) return null;
      return result.filePaths[0] || null;
    })
  );

  ipcMain.handle(
    "db-delete-session",
    safeHandler((event, id) => storageService.deleteSession(id))
  );

  ipcMain.handle(
    "db-get-messages",
    safeHandler((event, sessionId) => storageService.getMessages(sessionId))
  );

  ipcMain.handle(
    "db-add-message",
    safeHandler((event, { id, sessionId, role, content, metadata }) =>
      storageService.addMessage(sessionId, { id, role, content, metadata })
    )
  );

  ipcMain.handle(
    "db-delete-messages-after",
    safeHandler((event, { sessionId, timestamp }) =>
      storageService.deleteMessagesAfter(sessionId, timestamp)
    )
  );

  // --- Agent Inspector 监控与扩展 IPC ---
  ipcMain.handle(
    "get-mcp-servers",
    safeHandler((event, workDir) => storageService.getMcpServers(workDir))
  );

  ipcMain.handle(
    "save-mcp-servers",
    safeHandler((event, servers) => storageService.saveGlobalMcpServers(servers))
  );

  ipcMain.handle(
    "get-skills",
    safeHandler((event, workDir) => storageService.getSkills(workDir))
  );

  ipcMain.handle(
    "get-memories",
    safeHandler((event, workDir) => storageService.getMemories(workDir))
  );

  ipcMain.handle(
    "get-session-outputs",
    safeHandler((event, sessionId) => storageService.getSessionOutputs(sessionId))
  );

  ipcMain.handle(
    "get-context-metrics",
    safeHandler((event, params) => calculateContextMetrics(params))
  );

  ipcMain.handle(
    "get-workspace-git-status",
    safeHandler((event, workDir) => getWorkspaceGitStatus(workDir))
  );

  ipcMain.handle(
    "get-recent-projects",
    safeHandler(() => storageService.getRecentProjects())
  );

  ipcMain.handle(
    "add-recent-project",
    safeHandler((event, proj) => storageService.addRecentProject(proj))
  );

  // --- 工具注册与执行 IPC ---
  ipcMain.handle(
    "get-tools",
    safeHandler(() => toolRegistry.getToolSummaries())
  );

  ipcMain.handle(
    "execute-tool",
    safeHandler(async (event, { name, args }) => {
      return await toolRegistry.execute(name, args, toolRegistry.getContext());
    })
  );

  // 基础系统通道
  ipcMain.on("show-in-folder", (event, filePath) => {
    if (filePath && fs.existsSync(filePath)) {
      shell.showItemInFolder(filePath);
    }
  });

  ipcMain.handle(
    "select-save-directory",
    safeHandler(async () => {
      const result = await dialog.showOpenDialog(mainWindow, {
        properties: ["openDirectory"],
        title: "选择保存目录",
      });
      if (result.canceled) return null;
      return result.filePaths[0] || null;
    })
  );

  ipcMain.handle(
    "api-get-models",
    safeHandler(async () => {
      const { apiKey, baseUrl } = getApiConfig();
      if (!apiKey) return [];
      try {
        const response = await fetch(`${baseUrl}/models`, {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        const data = await response.json();
        if (response.ok && data.data) {
          return data.data;
        }
      } catch (err) {
        console.error("拉取远程模型列表失败:", err.message);
      }
      return [];
    })
  );

  // --- 流式聊天与 Agent 执行循环 ---
  ipcMain.on(
    "chat-request",
    async (event, { sessionId, messages, model, enableTools }) => {
      const { modelBaseUrl, modelApiKey, provider, apiModelId } =
        getModelConfig(model, "gpt-4o");

      if (!modelApiKey && provider !== "ollama") {
        event.reply(
          `chat-stream-error-${sessionId}`,
          "请先在【设置】中配置该模型的 API Key"
        );
        return;
      }

      // 获取当前会话的工作目录
      let sessionWorkDir = null;
      const session = storageService.getSessions().find((s) => s.id === sessionId);
      sessionWorkDir = session?.work_dir || null;

      // 设置工具上下文
      toolRegistry.setContext("workDir", sessionWorkDir);

      try {
        const headers = {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        };
        if (modelApiKey) {
          headers["Authorization"] = `Bearer ${modelApiKey}`;
        }

        let apiMessages = [...messages];

        // 拼接系统提示词、工作目录、激活技能与记忆
        const availableSkills = storageService.getSkills(sessionWorkDir);
        const memories = storageService.getMemories(sessionWorkDir);

        let systemInstruction = `你是专业的桌面端 AI Agent，专注于软件工程、代码理解与修改、架构分析与任务自动化。`;
        if (sessionWorkDir) {
          systemInstruction += `\n\n【工作区目录】当前会话根目录为: ${sessionWorkDir}\n所有文件查找、读写、执行命令默认相对于此目录进行。`;
        }

        if (memories.length > 0) {
          systemInstruction += `\n\n【用户记忆与约定】\n` +
            memories.map((m) => `[${m.name}]: ${m.content.trim()}`).join("\n\n");
        }

        if (enableTools && toolRegistry.size > 0) {
          const toolList = toolRegistry
            .getToolSummaries()
            .map((t) => `- **${t.name}**: ${t.description}`)
            .join("\n");
          systemInstruction += `\n\n【可用工具列表】\n${toolList}\n\n【执行原则】
1. 当需要了解目录结构时，主动调用 list_directory。
2. 当需要查看代码或配置时，主动调用 read_file。
3. 当需要查找函数或变量定义时，使用 search_code。
4. 修改或创建代码文件时使用 write_file，系统会自动将产物归档到右侧 Outputs 面板。
5. 执行终端命令时使用 run_command。`;
        }

        // 插入 system 提示词
        const hasSystem = apiMessages.length > 0 && apiMessages[0].role === "system";
        if (hasSystem) {
          apiMessages[0].content += "\n\n" + systemInstruction;
        } else {
          apiMessages.unshift({ role: "system", content: systemInstruction });
        }

        // 初始推送一次 Context 计量
        const initialTools = enableTools ? toolRegistry.getToolDefinitions() : [];
        const initMetrics = calculateContextMetrics({
          messages: apiMessages,
          tools: initialTools,
          systemPrompt: systemInstruction,
          activeSkills: availableSkills,
        });
        event.reply(`chat-stream-context-metrics-${sessionId}`, initMetrics);

        const MAX_TOOL_ROUNDS = 20;
        let toolRound = 0;
        let fullGeneratedText = "";

        function sendData(delta) {
          fullGeneratedText += delta;
          event.reply(`chat-stream-data-${sessionId}`, delta);
        }

        async function doStreamRequest(requestMessages, requestBody) {
          const requestBodyFinal = {
            model: apiModelId,
            messages: requestMessages,
            stream: true,
            max_tokens: 4096,
            temperature: 0.2,
            ...requestBody,
          };

          const resp = await fetch(`${modelBaseUrl}/chat/completions`, {
            method: "POST",
            headers,
            body: JSON.stringify(requestBodyFinal),
          });

          if (!resp.ok) {
            const errText = await resp.text();
            throw new Error(`API 请求失败 (${resp.status}): ${errText}`);
          }

          const reader = resp.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";
          let fullContent = "";
          let toolCalls = [];

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split(/\r?\n/);
            buffer = lines.pop() || "";

            for (const line of lines) {
              if (!line.startsWith("data:")) continue;
              const payload = line.slice(5).trim();
              if (payload === "[DONE]") continue;
              try {
                const json = JSON.parse(payload);
                const choice = json.choices?.[0];
                if (!choice) continue;
                const delta = choice.delta || {};

                if (delta.content) {
                  fullContent += delta.content;
                  sendData(delta.content);
                }

                if (delta.tool_calls) {
                  for (const tc of delta.tool_calls) {
                    const idx = tc.index;
                    if (!toolCalls[idx]) {
                      toolCalls[idx] = {
                        index: idx,
                        id: tc.id || "",
                        type: tc.type || "function",
                        function: { name: "", arguments: "" },
                      };
                    }
                    if (tc.id) toolCalls[idx].id = tc.id;
                    if (tc.type) toolCalls[idx].type = tc.type;
                    if (tc.function?.name) toolCalls[idx].function.name += tc.function.name;
                    if (tc.function?.arguments) toolCalls[idx].function.arguments += tc.function.arguments;
                  }
                }
              } catch (e) {
                // 忽略流中的 JSON 解析错误
              }
            }
          }

          return {
            content: fullContent,
            toolCalls: toolCalls.filter(Boolean),
          };
        }

        // Agent 工具执行循环
        while (toolRound < MAX_TOOL_ROUNDS) {
          let requestBody = {};
          if (enableTools) {
            requestBody.tools = toolRegistry.getToolDefinitions();
            requestBody.tool_choice = "auto";
          }

          const result = await doStreamRequest(apiMessages, requestBody);

          if (!enableTools || result.toolCalls.length === 0) {
            break;
          }

          toolRound++;

          for (const tc of result.toolCalls) {
            let args = {};
            try {
              args = JSON.parse(tc.function.arguments);
            } catch (e) {
              args = { _parseError: tc.function.arguments };
            }

            event.reply(`chat-stream-tool-status-${sessionId}`, {
              tool: tc.function.name,
              status: "running",
              args,
              callId: tc.id,
            });

            // 执行工具
            const execResult = await toolRegistry.execute(
              tc.function.name,
              args,
              toolRegistry.getContext()
            );

            // 若调用了 write_file，将产出物自动挂载到 Outputs
            if (tc.function.name === "write_file" && execResult?.success) {
              const fullOutPath = path.isAbsolute(args.path)
                ? args.path
                : path.join(sessionWorkDir || "", args.path);
              storageService.addSessionOutput(sessionId, {
                name: path.basename(args.path),
                filePath: fullOutPath,
                fileType: path.extname(args.path).replace(".", "") || "file",
              });
              // 通知前端刷新产物
              event.reply(`session-outputs-updated-${sessionId}`);
            }

            event.reply(`chat-stream-tool-status-${sessionId}`, {
              tool: tc.function.name,
              status: "done",
              args,
              result: execResult,
              callId: tc.id,
            });

            apiMessages.push({
              role: "assistant",
              content: "",
              tool_calls: [
                {
                  id: tc.id,
                  type: "function",
                  function: {
                    name: tc.function.name,
                    arguments: tc.function.arguments,
                  },
                },
              ],
            });

            apiMessages.push({
              role: "tool",
              tool_call_id: tc.id,
              content: JSON.stringify(execResult),
            });
          }

          // 每轮后更新 Context 计量
          const updatedMetrics = calculateContextMetrics({
            messages: apiMessages,
            tools: initialTools,
            systemPrompt: systemInstruction,
            activeSkills: availableSkills,
          });
          event.reply(`chat-stream-context-metrics-${sessionId}`, updatedMetrics);
        }

        // 完成时保存助理消息到 JSON
        storageService.addMessage(sessionId, {
          role: "assistant",
          content: fullGeneratedText,
          metadata: { toolRounds: toolRound },
        });

        // 最终推送一次 Context
        const finalMetrics = calculateContextMetrics({
          messages: apiMessages,
          tools: initialTools,
          systemPrompt: systemInstruction,
          activeSkills: availableSkills,
        });
        event.reply(`chat-stream-context-metrics-${sessionId}`, finalMetrics);

        event.reply(`chat-stream-end-${sessionId}`, {
          metadata: { toolRounds: toolRound },
        });
      } catch (err) {
        console.error(`[chat-stream error ${sessionId}]`, err);
        event.reply(`chat-stream-error-${sessionId}`, err.message);
      }
    }
  );

  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
