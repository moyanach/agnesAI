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
const Database = require("better-sqlite3");
const https = require("https");
const http = require("http");
const { pathToFileURL } = require("url");
const crypto = require("crypto");
const { toolRegistry } = require("./utils/toolRegistry");

// 注册 web_search 工具（依赖 main.js scope 中的 performWebSearch 和 scrapePageContent）
// 在 app.whenReady() 内注册，确保所有辅助函数已定义
// 注册位置：app.on("ready") 回调中，createWindow 之前

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

// 1. 初始化本地 SQLite 数据库
let db;
function initDatabase() {
  const userDataPath = app.getPath("userData");
  const dbPath = path.join(userDataPath, "agnes_data.db");
  db = new Database(dbPath);

  // 创建 outputs 目录用于缓存生成的图片和视频
  const outputsPath = path.join(userDataPath, "outputs");
  if (!fs.existsSync(outputsPath)) {
    fs.mkdirSync(outputsPath);
  }

  // 创建配置表 (存储 API Key, 自定义路径等)
  db.exec(`
    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  // 创建聊天会话与消息表
  db.exec(`
    CREATE TABLE IF NOT EXISTS chat_sessions (
      id TEXT PRIMARY KEY,
      title TEXT,
      updated_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      session_id TEXT,
      role TEXT,
      content TEXT,
      created_at INTEGER
    );
  `);

  // 创建媒体生成任务表
  db.exec(`
    CREATE TABLE IF NOT EXISTS media_tasks (
      id TEXT PRIMARY KEY,
      type TEXT,
      prompt TEXT,
      local_url TEXT,
      status TEXT,
      created_at INTEGER
    );
  `);

  // 升级 media_tasks 任务表以包含 model 字段
  try {
    db.exec("ALTER TABLE media_tasks ADD COLUMN model TEXT;");
  } catch (err) {
    // 已经包含该列
  }

  // 创建多模型配置表
  db.exec(`
    CREATE TABLE IF NOT EXISTS llm_models (
      id TEXT PRIMARY KEY,
      model_id TEXT NOT NULL,
      name TEXT,
      type TEXT NOT NULL,
      provider TEXT NOT NULL,
      base_url TEXT NOT NULL,
      api_key TEXT
    );
  `);

  // 升级 chat_sessions 会话表以包含 model 字段
  try {
    db.exec("ALTER TABLE chat_sessions ADD COLUMN model TEXT;");
  } catch (err) {
    // 已经包含该列
  }

  // 升级 chat_sessions 会话表以包含 search_enabled 字段
  try {
    db.exec(
      "ALTER TABLE chat_sessions ADD COLUMN search_enabled INTEGER DEFAULT 0;",
    );
  } catch (err) {
    // 已经包含该列
  }

  // 升级 chat_sessions 会话表以包含 work_dir 字段
  try {
    db.exec(
      "ALTER TABLE chat_sessions ADD COLUMN work_dir TEXT;",
    );
  } catch (err) {
    // 已经包含该列
  }

  // 升级 chat_messages 消息表以包含 metadata 字段
  try {
    db.exec("ALTER TABLE chat_messages ADD COLUMN metadata TEXT;");
  } catch (err) {
    // 已经包含该列
  }

  // 插入默认预置模型（如为空）
  try {
    const count = db
      .prepare("SELECT COUNT(*) as count FROM llm_models")
      .get().count;
    if (count === 0) {
      let globalApiKey = "";
      let globalBaseUrl = "https://apihub.agnes-ai.com/v1";
      try {
        const apiKeyRow = db
          .prepare("SELECT value FROM config WHERE key = 'api_key'")
          .get();
        if (apiKeyRow) globalApiKey = apiKeyRow.value;
        const baseUrlRow = db
          .prepare("SELECT value FROM config WHERE key = 'base_url'")
          .get();
        if (baseUrlRow) globalBaseUrl = baseUrlRow.value;
      } catch (e) {}

      const insert = db.prepare(
        "INSERT INTO llm_models (id, model_id, name, type, provider, base_url, api_key) VALUES (?, ?, ?, ?, ?, ?, ?)",
      );
      insert.run(
        "model_chat_default",
        "agnes-2.0-flash",
        "Agnes Chat (默认)",
        "chat",
        "agnes",
        globalBaseUrl,
        globalApiKey || null,
      );
      insert.run(
        "model_image_default",
        "agnes-image-2.1-flash",
        "Agnes Image (默认)",
        "image",
        "agnes",
        globalBaseUrl,
        globalApiKey || null,
      );
      insert.run(
        "model_video_default",
        "agnes-video-v2.0",
        "Agnes Video (默认)",
        "video",
        "agnes",
        globalBaseUrl,
        globalApiKey || null,
      );
    }
  } catch (err) {
    console.error("初始化预置模型失败:", err.message);
  }
}

// 文件下载辅助函数
async function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const client = parsedUrl.protocol === "https:" ? https : http;

    client
      .get(url, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP Status ${res.statusCode}`));
          return;
        }
        const fileStream = fs.createWriteStream(destPath);
        res.pipe(fileStream);
        fileStream.on("finish", () => {
          fileStream.close(resolve);
        });
      })
      .on("error", (err) => {
        reject(err);
      });
  });
}

// 读取系统配置辅助函数
function getApiConfig() {
  const apiKey = db
    .prepare("SELECT value FROM config WHERE key = 'api_key'")
    .get()?.value;
  const baseUrl =
    db.prepare("SELECT value FROM config WHERE key = 'base_url'").get()
      ?.value || "https://apihub.agnes-ai.com/v1";
  const savePath = db
    .prepare("SELECT value FROM config WHERE key = 'save_path'")
    .get()?.value;
  return { apiKey, baseUrl, savePath };
}

// 读取搜索配置辅助函数
function getSearchConfig() {
  const provider =
    db.prepare("SELECT value FROM config WHERE key = 'search_provider'").get()
      ?.value || "duckduckgo";
  const apiKey =
    db.prepare("SELECT value FROM config WHERE key = 'search_api_key'").get()
      ?.value || "";
  const maxResultsVal =
    db
      .prepare("SELECT value FROM config WHERE key = 'search_max_results'")
      .get()?.value || "3";
  const maxResults = parseInt(maxResultsVal, 10) || 3;
  return { provider, apiKey, maxResults };
}

function formatDateLabel(timestamp) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(Number(timestamp || Date.now()));
  const day = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  const diffDays = Math.floor((today - day) / 86400000);

  if (diffDays === 0) return "今天";
  if (diffDays === 1) return "昨天";

  const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  return weekdays[target.getDay()];
}

function getDateKey(timestamp) {
  const d = new Date(Number(timestamp || Date.now()));
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getLast7Days() {
  const days = [];
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    d.setHours(0, 0, 0, 0);
    const key = getDateKey(d.getTime());
    days.push({
      date: key,
      label: i === 0 ? "今天" : i === 1 ? "昨天" : formatDateLabel(d.getTime()),
      count: 0,
    });
  }
  return days;
}

function getDashboardStats() {
  const conversationCount = db
    .prepare("SELECT COUNT(*) AS total FROM chat_sessions")
    .get().total;
  const imageCount = db
    .prepare("SELECT COUNT(*) AS total FROM media_tasks WHERE type = 'image'")
    .get().total;
  const videoCount = db
    .prepare("SELECT COUNT(*) AS total FROM media_tasks WHERE type = 'video'")
    .get().total;

  const messageRows = db
    .prepare("SELECT created_at FROM chat_messages")
    .all();
  const dailyActivity = getLast7Days();
  const dayMap = new Map(dailyActivity.map((d) => [d.date, d]));
  for (const row of messageRows) {
    const key = getDateKey(row.created_at);
    if (dayMap.has(key)) {
      dayMap.get(key).count += 1;
    }
  }
  const activeDaysLast7 = dailyActivity.filter((d) => d.count > 0).length;

  const recentConversations = db
    .prepare(
      `SELECT
        s.id,
        s.title,
        s.updated_at,
        COUNT(m.id) AS messageCount
      FROM chat_sessions s
      LEFT JOIN chat_messages m ON m.session_id = s.id
      GROUP BY s.id
      ORDER BY s.updated_at DESC
      LIMIT 5`,
    )
    .all();

  const recentMediaTasks = db
    .prepare(
      "SELECT id, type, status, created_at, model, prompt FROM media_tasks ORDER BY created_at DESC LIMIT 5",
    )
    .all();

  return {
    conversationCount,
    imageCount,
    videoCount,
    activeDaysLast7,
    dailyActivity,
    recentConversations,
    recentMediaTasks,
  };
}

// IPC handler 安全包装（自动捕获异常，避免主进程崩溃）
function safeHandler(handler) {
  return async (event, ...args) => {
    try {
      return await handler(event, ...args);
    } catch (err) {
      console.error(`[IPC Error] ${handler.name || "anonymous"}:`, err);
      throw new Error(err.message || "Internal error");
    }
  };
}

// 统一获取模型配置（消除 chat/image/video/poll 中的重复查询逻辑）
function getModelConfig(model, defaultModelId) {
  const { apiKey: globalApiKey, baseUrl: globalBaseUrl } = getApiConfig();

  let modelBaseUrl = globalBaseUrl;
  let modelApiKey = globalApiKey;
  let provider = "agnes";
  let apiModelId = model || defaultModelId;

  if (model) {
    const modelRow = db
      .prepare(
        "SELECT model_id, base_url, api_key, provider FROM llm_models WHERE id = ? OR model_id = ?",
      )
      .get(model, model);
    if (modelRow) {
      modelBaseUrl = modelRow.base_url || modelBaseUrl;
      modelApiKey = modelRow.api_key;
      provider = modelRow.provider;
      apiModelId = modelRow.model_id;
    }
  }

  return { modelBaseUrl, modelApiKey, provider, apiModelId };
}

// 使用 AbortController timeout 的 fetch 封装 — 已迁移至 utils/tools/webTools.js

// 2. 窗口创建逻辑 (适配微信左右分栏最佳比例)
let mainWindow;
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 1000,
    minHeight: 700,
    titleBarStyle: "hiddenInset", // macOS 隐藏标题栏保留红绿灯
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  // 构建产物优先：始终先尝试从 dist/ 加载，开发服务器仅当 VITE_DEV_SERVER 环境变量显式设置
  const devServerUrl = process.env.VITE_DEV_SERVER;
  if (devServerUrl) {
    console.log("[main] Using Vite dev server:", devServerUrl);
    mainWindow.loadURL(devServerUrl);
  } else {
    const distIndex = path.join(__dirname, "dist", "index.html");
    console.log(
      "[main] Loading from dist:",
      distIndex,
      "exists:",
      fs.existsSync(distIndex),
    );
    mainWindow.loadURL("app://dist/index.html");
  }
  // VITE_DEV_SERVER 或 DEBUG_AGNES 设置时打开 DevTools 辅助调试
  if (devServerUrl || process.env.DEBUG_AGNES) {
    mainWindow.webContents.openDevTools();
  }
  // 捕获渲染进程错误
  mainWindow.webContents.on(
    "console-message",
    (event, level, message, line, sourceId) => {
      console.log(`[renderer:${level}] ${message} (${sourceId}:${line})`);
    },
  );
  mainWindow.webContents.on(
    "did-fail-load",
    (event, errorCode, errorDescription, validatedURL) => {
      console.log(
        `[main] did-fail-load: ${validatedURL}, error: ${errorCode} ${errorDescription}`,
      );
    },
  );

  // 拦截外链并在系统浏览器中打开
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http://") || url.startsWith("https://")) {
      shell.openExternal(url);
    }
    return { action: "deny" };
  });
}

// 3. 注册 IPC 事件与生命周期
app.whenReady().then(() => {
  initDatabase();

  // 注册自定义本地媒体协议 local-media://，突破跨域 and 安全限制读取硬盘文件
  protocol.handle("local-media", async (request) => {
    try {
      let filePath = request.url;
      // 1. 移除协议前缀
      if (filePath.startsWith("local-media://")) {
        filePath = filePath.slice("local-media://".length);
      }
      // 2. 移除查询参数或 hash
      const queryIndex = filePath.indexOf("?");
      if (queryIndex !== -1) {
        filePath = filePath.substring(0, queryIndex);
      }
      const hashIndex = filePath.indexOf("#");
      if (hashIndex !== -1) {
        filePath = filePath.substring(0, hashIndex);
      }
      // 3. 对路径进行 URI 解码
      filePath = decodeURIComponent(filePath);

      // 4. 平台特定的绝对路径整理
      if (process.platform === "win32") {
        if (filePath.startsWith("/")) {
          filePath = filePath.slice(1);
        }
        filePath = filePath.replace(/\//g, "\\");
      } else {
        // macOS / Linux 确保以 / 开头
        if (!filePath.startsWith("/")) {
          filePath = "/" + filePath;
        }
      }

      const fileUrl = pathToFileURL(filePath).toString();
      const response = await net.fetch(fileUrl, {
        bypassCustomProtocolHandlers: true,
      });

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

  // 注册主包资源特权协议 app://，解决 Vite 在 file 协议下因为 ES Module (type="module") 产生的跨域 CORS 拦截白屏问题
  protocol.handle("app", async (request) => {
    const url = new URL(request.url);
    let filePath;
    if (url.host === "dist") {
      filePath = path.join(__dirname, "dist", decodeURIComponent(url.pathname));
    } else {
      filePath = path.join(__dirname, decodeURIComponent(url.pathname));
    }
    const fileUrl = pathToFileURL(filePath).toString();
    const response = await net.fetch(fileUrl, {
      bypassCustomProtocolHandlers: true,
    });
    // 确保 JS 和 CSS 文件的 Content-Type 正确（ES Module 需要正确的 MIME）
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

  // --- 数据库配置操作 IPC ---
  ipcMain.handle(
    "get-config",
    safeHandler((event, key) => {
      const row = db.prepare("SELECT value FROM config WHERE key = ?").get(key);
      return row ? row.value : null;
    }),
  );

  ipcMain.handle(
    "set-config",
    safeHandler((event, key, value) => {
      db.prepare(
        "INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)",
      ).run(key, value);
      return true;
    }),
  );

  // --- LLM 多模型配置管理 IPC ---
  ipcMain.handle(
    "db-get-models",
    safeHandler(() => {
      return db.prepare("SELECT * FROM llm_models").all();
    }),
  );

  ipcMain.handle(
    "db-add-model",
    safeHandler(
      (event, { id, modelId, name, type, provider, baseUrl, apiKey }) => {
        db.prepare(
          "INSERT OR REPLACE INTO llm_models (id, model_id, name, type, provider, base_url, api_key) VALUES (?, ?, ?, ?, ?, ?, ?)",
        ).run(id, modelId, name, type, provider, baseUrl, apiKey || null);
        return true;
      },
    ),
  );

  ipcMain.handle(
    "db-delete-model",
    safeHandler((event, id) => {
      db.prepare("DELETE FROM llm_models WHERE id = ?").run(id);
      return true;
    }),
  );

  // --- 对接大模型 API (流式聊天) ---
  ipcMain.on(
    "chat-request",
    async (event, { sessionId, messages, model, enableTools }) => {
      const { modelBaseUrl, modelApiKey, provider, apiModelId } =
        getModelConfig(model, "agnes-chat");

      if (!modelApiKey && provider !== "ollama") {
        event.reply(
          `chat-stream-error-${sessionId}`,
          "请先在【设置】中配置该模型的 API Key",
        );
        return;
      }

      // 获取当前会话的工作目录
      let sessionWorkDir = null;
      try {
        const row = db.prepare("SELECT work_dir FROM chat_sessions WHERE id = ?").get(sessionId);
        sessionWorkDir = row?.work_dir || null;
      } catch (err) {
        console.error("[main] 获取会话工作目录失败:", err.message);
      }

      // 设置工具上下文
      if (sessionWorkDir) {
        toolRegistry.setContext("workDir", sessionWorkDir);
        console.log(`[main] 会话 ${sessionId} 工作目录: ${sessionWorkDir}`);
      } else {
        toolRegistry.setContext("workDir", null);
      }

      try {
        const headers = {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        };
        if (modelApiKey) {
          headers["Authorization"] = `Bearer ${modelApiKey}`;
        }

        // 构建 messages 上下文
        let apiMessages = [...messages];

        // ─── 工具 Agent 系统提示词 ────────────────────────
        if (enableTools && toolRegistry.size > 0) {
          const workDirInfo = sessionWorkDir ? `\n\n当前会话工作目录: ${sessionWorkDir}\n\n所有文件读写、目录浏览、代码搜索、生成文件操作，都默认以当前会话工作目录为根目录。` : "";

          const toolPrompt =
            `【重要规则】你是本项目文件分析和代码审查专家。当用户要求分析文件、代码、目录结构、项目内容时，你必须使用提供的工具来获取信息，不要编造或猜测。${workDirInfo}

【可用工具列表】\n` +
            toolRegistry
              .getToolSummaries()
              .map((t) => `- **${t.name}**: ${t.description}`)
              .join("\n") +
            `\n\n【强制使用规则】
1. 当用户要求分析目录/项目结构时，你必须先调用 list_directory 工具
2. 当用户要求查看/分析文件内容时，你必须调用 read_file 工具
3. 当用户要求搜索代码时，你必须调用 search_code 工具
4. 当用户要求修改文件时，先用 read_file 确认内容，再调用 write_file
5. 当用户要求运行命令时，调用 run_command 工具
6. 当用户需要实时信息时，调用 web_search / web_fetch
7. 不要直接输出文件路径或文件内容——始终通过工具获取真实数据
8. write_file 和 run_command 是危险操作，请先向用户展示方案，得到确认后再执行`;

          // 插入系统提示词
          const hasSystem =
            apiMessages.length > 0 && apiMessages[0].role === "system";
          if (hasSystem) {
            // 如果已有 system 消息，追加工具说明
            apiMessages[0].content += "\n\n" + toolPrompt;
          } else {
            apiMessages.unshift({ role: "system", content: toolPrompt });
          }
        }

        // ─── 流式 LLM 请求（支持 Function Calling 循环） ────
        const MAX_TOOL_ROUNDS = 5000;
        let toolRound = 0;
        const finalMetadata = [];

        // 复用的事件回复函数
        function sendData(data) {
          event.reply(`chat-stream-data-${sessionId}`, data);
        }

        function sanitizeErrorText(text) {
          return String(text || "")
            .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [REDACTED]")
            .replace(/sk-[A-Za-z0-9_-]{16,}/g, "[REDACTED_API_KEY]")
            .replace(/api[_-]?key["'\s:=]+[A-Za-z0-9._~+/=-]{8,}/gi, (m) =>
              m.replace(/[A-Za-z0-9._~+/=-]{8,}/, "[REDACTED]"),
            )
            .trim()
            .slice(0, 4000);
        }

        async function readErrorResponse(resp) {
          try {
            const contentType = resp.headers.get("content-type") || "";
            if (contentType.includes("application/json")) {
              const json = await resp.json();
              return sanitizeErrorText(JSON.stringify(json, null, 2));
            }
            return sanitizeErrorText(await resp.text());
          } catch (err) {
            return sanitizeErrorText(`无法读取响应体: ${err.message}`);
          }
        }

        async function doStreamRequest(requestMessages, requestBody) {
          const requestBodyFinal = {
            model: apiModelId,
            messages: requestMessages,
            stream: true,
            // Agent/Function Calling 需要足够的输出预算；否则模型可能在调用工具后没有 token 继续下一轮
            max_tokens: 4096,
            temperature: 0.2,
            top_p: 0.8,
            ...requestBody,
          };

          const resp = await fetch(`${modelBaseUrl}/chat/completions`, {
            method: "POST",
            headers,
            body: JSON.stringify(requestBodyFinal),
          });

          if (!resp.ok) {
            const responseBody = await readErrorResponse(resp);
            const errorDetail = {
              type: "HTTP_ERROR",
              status: resp.status,
              statusText: resp.statusText,
              url: `${modelBaseUrl}/chat/completions`,
              model: apiModelId,
              toolRound,
              requestBody: {
                toolsCount: requestBody.tools?.length || 0,
                toolChoice: requestBody.tool_choice || null,
                messagesCount: requestMessages.length,
                messageRoles: requestMessages.map((m) => m.role),
              },
              responseBody,
            };
            throw new Error(JSON.stringify(errorDetail, null, 2));
          }

          const reader = resp.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";
          let fullContent = "";
          /** @type {Array<{index:number, id:string, type:string, function:{name:string, arguments:string}}>} */
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

                // 文本内容增量
                if (delta.content) {
                  fullContent += delta.content;
                }

                // Tool call 增量（可能跨多个 chunk 分批到达）
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
                    if (tc.function?.name)
                      toolCalls[idx].function.name += tc.function.name;
                    if (tc.function?.arguments)
                      toolCalls[idx].function.arguments +=
                        tc.function.arguments;
                  }
                }
              } catch (e) {
                // 忽略 JSON 解析错误
              }
            }
          }

          return {
            content: fullContent,
            toolCalls: toolCalls.filter(Boolean),
          };
        }

        // 工具调用主循环
        while (toolRound < MAX_TOOL_ROUNDS) {
          let requestBody = {};

          // 初始请求才传入 tools 定义
          if (enableTools && toolRound === 0) {
            requestBody.tools = toolRegistry.getToolDefinitions();
            requestBody.tool_choice = "auto";
          } else if (enableTools) {
            // 后续轮次必须继续传 tools，否则部分 OpenAI 兼容 API 在收到 tool 消息后不会继续生成工具调用
            requestBody.tools = toolRegistry.getToolDefinitions();
            requestBody.tool_choice = "auto";
          }

          const result = await doStreamRequest(apiMessages, requestBody);

          // 先把 content 流到前端（即使后续还有工具调用）
          if (result.content) {
            sendData(result.content);
          }

          if (!enableTools || result.toolCalls.length === 0) {
            // 没有工具调用 → 完成
            break;
          }

          // ── 有工具调用 ──
          toolRound++;

          for (const tc of result.toolCalls) {
            let args = {};
            try {
              args = JSON.parse(tc.function.arguments);
            } catch (e) {
              args = { _parseError: tc.function.arguments };
            }

            // 通知前端：工具开始执行
            event.reply(`chat-stream-tool-status-${sessionId}`, {
              tool: tc.function.name,
              status: "running",
              args,
              callId: tc.id,
            });

            // 执行工具，传递上下文
            const execResult = await toolRegistry.execute(
              tc.function.name,
              args,
              toolRegistry.getContext(),
            );

            // 通知前端：工具执行完成
            event.reply(`chat-stream-tool-status-${sessionId}`, {
              tool: tc.function.name,
              status: "done",
              args,
              result: execResult,
              callId: tc.id,
            });

            // 将 assistant 的 tool_call 追加到消息列表
            // content 必须为空字符串而非 null（部分 OpenAI 兼容 API 不支持 null）
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

            // 将 tool 的执行结果追加到消息列表
            apiMessages.push({
              role: "tool",
              tool_call_id: tc.id,
              content: JSON.stringify(execResult),
            });
          }

          // 继续循环：用更新后的消息列表再次请求 LLM
        }

        if (toolRound >= MAX_TOOL_ROUNDS) {
          // 超过最大工具循环次数，追加一条提示
          sendData(
            `\n\n> ⚠️ 工具调用次数超过限制（${MAX_TOOL_ROUNDS} 轮），已自动终止。如有需要，请重新提问。`,
          );
        }

        event.reply(`chat-stream-end-${sessionId}`, {
          metadata: finalMetadata,
        });
      } catch (err) {
        event.reply(`chat-stream-error-${sessionId}`, err.message);
      }
    },
  );

  // --- SQLite CRUD Operations IPC ---
  // Chat Sessions
  ipcMain.handle(
    "db-get-sessions",
    safeHandler(() => {
      return db
        .prepare("SELECT * FROM chat_sessions ORDER BY updated_at DESC")
        .all();
    }),
  );

  ipcMain.handle(
    "db-add-session",
    safeHandler((event, { id, title, model }) => {
      db.prepare(
        "INSERT OR REPLACE INTO chat_sessions (id, title, model, search_enabled, work_dir, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
      ).run(id, title, model || null, 0, null, Date.now());
      return true;
    }),
  );

  ipcMain.handle(
    "db-update-session-title",
    safeHandler((event, id, title) => {
      const normalizedTitle = String(title || "").trim();
      if (!normalizedTitle) {
        return false;
      }

      db.prepare("UPDATE chat_sessions SET title = ? WHERE id = ?").run(
        normalizedTitle,
        id,
      );
      return true;
    }),
  );

  ipcMain.handle(
    "db-update-session-work-dir",
    safeHandler((event, id, workDir) => {
      const normalizedDir = workDir ? String(workDir).trim() : null;
      db.prepare("UPDATE chat_sessions SET work_dir = ? WHERE id = ?").run(
        normalizedDir,
        id,
      );
      return true;
    }),
  );

  ipcMain.handle(
    "db-get-session-work-dir",
    safeHandler((event, id) => {
      const row = db.prepare("SELECT work_dir FROM chat_sessions WHERE id = ?").get(id);
      return row?.work_dir || null;
    }),
  );

  ipcMain.handle(
    "db-select-session-with-work-dir",
    safeHandler((event) => {
      return db.prepare("SELECT * FROM chat_sessions ORDER BY updated_at DESC").all();
    }),
  );

  ipcMain.handle(
    "dialog-select-work-directory",
    safeHandler(async (event) => {
      const result = await dialog.showOpenDialog(mainWindow, {
        properties: ["openDirectory"],
        title: "选择会话工作目录",
      });
      if (result.canceled) {
        return null;
      }
      return result.filePaths[0] || null;
    }),
  );

  ipcMain.handle(
    "db-delete-session",
    safeHandler((event, id) => {
      db.prepare("DELETE FROM chat_sessions WHERE id = ?").run(id);
      db.prepare("DELETE FROM chat_messages WHERE session_id = ?").run(id);
      return true;
    }),
  );

  ipcMain.handle(
    "db-delete-messages-after",
    safeHandler((event, { sessionId, timestamp }) => {
      db.prepare(
        "DELETE FROM chat_messages WHERE session_id = ? AND created_at > ?",
      ).run(sessionId, timestamp);
      return true;
    }),
  );

  // Chat Messages
  ipcMain.handle(
    "db-get-messages",
    safeHandler((event, sessionId) => {
      return db
        .prepare(
          "SELECT * FROM chat_messages WHERE session_id = ? ORDER BY created_at ASC",
        )
        .all(sessionId);
    }),
  );

  ipcMain.handle(
    "db-add-message",
    safeHandler((event, { id, sessionId, role, content, metadata }) => {
      const metaStr = metadata
        ? typeof metadata === "string"
          ? metadata
          : JSON.stringify(metadata)
        : null;
      db.prepare(
        "INSERT OR REPLACE INTO chat_messages (id, session_id, role, content, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      ).run(id, sessionId, role, content, metaStr, Date.now());

      // 更新会话的 updated_at 字段
      db.prepare("UPDATE chat_sessions SET updated_at = ? WHERE id = ?").run(
        Date.now(),
        sessionId,
      );
      return true;
    }),
  );

  // Media Tasks (History)
  ipcMain.handle(
    "db-get-media-tasks",
    safeHandler((event, type) => {
      if (type) {
        return db
          .prepare(
            "SELECT * FROM media_tasks WHERE type = ? ORDER BY created_at DESC",
          )
          .all(type);
      }
      return db
        .prepare("SELECT * FROM media_tasks ORDER BY created_at DESC")
        .all();
    }),
  );

  ipcMain.handle(
    "db-get-dashboard-stats",
    safeHandler(() => {
      return getDashboardStats();
    }),
  );

  ipcMain.handle(
    "db-delete-media-task",
    safeHandler((event, id) => {
      const row = db
        .prepare("SELECT local_url FROM media_tasks WHERE id = ?")
        .get(id);
      if (row && row.local_url && row.local_url.startsWith("local-media://")) {
        const filePath = row.local_url.replace("local-media://", "");
        try {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        } catch (err) {
          console.error("删除本地媒体文件失败:", err.message);
        }
      }
      db.prepare("DELETE FROM media_tasks WHERE id = ?").run(id);
      return true;
    }),
  );

  // --- AI API Operations IPC ---
  // 拉取模型列表
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
        console.error("拉取模型列表失败:", err.message);
      }
      return [];
    }),
  );

  // 同步生成图像并下载
  ipcMain.handle(
    "api-generate-image",
    safeHandler(async (event, params) => {
      const { modelBaseUrl, modelApiKey, provider, apiModelId } =
        getModelConfig(params.model, "agnes-image-2.1-flash");
      const { savePath } = getApiConfig();

      if (!modelApiKey && provider !== "ollama") {
        throw new Error("请先在【设置】中配置该模型的 API Key");
      }

      const headers = {};
      if (modelApiKey) {
        headers["Authorization"] = `Bearer ${modelApiKey}`;
      }

      let response;
      let data;
      const prompt = params.prompt; // 保存 prompt，避免被删除
      const model = params.model; // 保存 model，避免被删除

      // 图生图与文生图统一使用 /images/generations 端点 (JSON)
      headers["Content-Type"] = "application/json";

      const requestBody = {
        ...params,
        model: apiModelId,
      };

      // 图生图：将 image_url 放到 extra_body.image 数组中
      if (params.image_url) {
        requestBody.extra_body = {
          image: [params.image_url],
          response_format: "url",
        };
        delete requestBody.image_url;
      } else {
        delete requestBody.image_url;
      }

      response = await fetch(`${modelBaseUrl}/images/generations`, {
        method: "POST",
        headers,
        body: JSON.stringify(requestBody),
      });

      data = await response.json();
      if (!response.ok) {
        throw new Error(
          data.error?.message ||
            data.message ||
            `HTTP 错误: ${response.status}`,
        );
      }

      const imageUrl = data.data?.[0]?.url;
      if (!imageUrl) throw new Error("未返回有效的图片 URL");

      // 下载图片
      const userDataPath = app.getPath("userData");
      const filename = `${Date.now()}_img.png`;
      const targetDir =
        savePath && fs.existsSync(savePath)
          ? savePath
          : path.join(userDataPath, "outputs");
      const destPath = path.join(targetDir, filename);

      await downloadFile(imageUrl, destPath);
      const localUrl = `local-media://${destPath}`;

      // 保存到 SQLite 历史
      const taskId = `img_${crypto.randomUUID()}`;
      db.prepare(
        `
      INSERT INTO media_tasks (id, type, prompt, local_url, status, created_at, model)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
      ).run(
        taskId,
        "image",
        prompt,
        localUrl,
        "completed",
        Date.now(),
        model || null,
      );

      return { id: taskId, localUrl, prompt: prompt, status: "completed" };
    }),
  );

  // 提交视频生成任务
  ipcMain.handle(
    "api-generate-video",
    safeHandler(async (event, params) => {
      const { modelBaseUrl, modelApiKey, provider, apiModelId } =
        getModelConfig(params.model, "agnes-video-v2.0");

      if (!modelApiKey && provider !== "ollama") {
        throw new Error("请先在【设置】中配置该模型的 API Key");
      }

      const headers = {
        "Content-Type": "application/json",
      };
      if (modelApiKey) {
        headers["Authorization"] = `Bearer ${modelApiKey}`;
      }

      const response = await fetch(`${modelBaseUrl}/videos`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          ...params,
          model: apiModelId,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(
          data.error?.message ||
            data.message ||
            `HTTP 错误: ${response.status}`,
        );
      }

      const taskId = data.id;
      const status = data.status || "queued";

      // 保存到 SQLite 任务库
      db.prepare(
        `
      INSERT INTO media_tasks (id, type, prompt, local_url, status, created_at, model)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
      ).run(
        taskId,
        "video",
        params.prompt,
        "",
        status,
        Date.now(),
        params.model || null,
      );

      return { id: taskId, status, prompt: params.prompt };
    }),
  );

  // 轮询视频生成状态并下载
  ipcMain.handle(
    "api-poll-video",
    safeHandler(async (event, taskId) => {
      const { savePath } = getApiConfig();
      const { modelBaseUrl, modelApiKey, provider } = getModelConfig(
        db
          .prepare("SELECT model FROM media_tasks WHERE id = ?")
          .pluck()
          .get(taskId),
        "agnes-video-v2.0",
      );

      if (!modelApiKey && provider !== "ollama") {
        throw new Error("请先在【设置】中配置该模型的 API Key");
      }

      const headers = {};
      if (modelApiKey) {
        headers["Authorization"] = `Bearer ${modelApiKey}`;
      }

      const response = await fetch(
        `${modelBaseUrl}/videos/${taskId}?_t=${Date.now()}`,
        {
          headers,
        },
      );

      const data = await response.json();
      if (!response.ok && !data.status) {
        throw new Error(
          data.error?.message ||
            data.message ||
            `HTTP 错误: ${response.status}`,
        );
      }

      const status = data.status;
      let localUrl = "";

      if (status === "completed") {
        const rawUrl = data.video_url || data.remixed_from_video_id;
        if (rawUrl) {
          const userDataPath = app.getPath("userData");
          const filename = `${taskId}.mp4`;
          const targetDir =
            savePath && fs.existsSync(savePath)
              ? savePath
              : path.join(userDataPath, "outputs");
          const destPath = path.join(targetDir, filename);

          try {
            await downloadFile(rawUrl, destPath);
            localUrl = `local-media://${destPath}`;
          } catch (err) {
            console.error("视频下载失败:", err.message);
            localUrl = rawUrl; // 回退使用原始 URL
          }
        }
      }

      // 更新 SQLite 数据库中的状态和 localUrl
      db.prepare(
        `
      UPDATE media_tasks
      SET status = ?, local_url = ?
      WHERE id = ?
    `,
      ).run(status, localUrl, taskId);

      return { id: taskId, status, localUrl, data };
    }),
  );

  // --- Tool Registry IPC ---
  ipcMain.handle(
    "get-tools",
    safeHandler(() => {
      return toolRegistry.getToolDefinitions();
    }),
  );

  ipcMain.handle(
    "execute-tool",
    safeHandler(async (event, { name, args }) => {
      return await toolRegistry.execute(name, args);
    }),
  );

  // --- 其他 IPC 通信通道 ---
  ipcMain.on("show-in-folder", (event, filePath) => {
    // 兼容协议前缀
    const cleanPath = filePath ? filePath.replace("local-media://", "") : "";
    if (cleanPath) shell.showItemInFolder(cleanPath);
  });

  ipcMain.handle(
    "select-save-directory",
    safeHandler(async () => {
      const result = await dialog.showOpenDialog(mainWindow, {
        properties: ["openDirectory"],
        title: "选择生成结果的保存目录",
      });
      if (!result.canceled && result.filePaths.length > 0) {
        const selectedPath = result.filePaths[0];
        db.prepare(
          "INSERT OR REPLACE INTO config (key, value) VALUES ('save_path', ?)",
        ).run(selectedPath);
        return selectedPath;
      }
      return null;
    }),
  );

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
