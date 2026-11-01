const fs = require("fs");
const path = require("path");
const os = require("os");

const USER_HOME = os.homedir();
let AGNES_HOME = process.env.AGNES_HOME || path.join(USER_HOME, ".agnes");
let CONFIG_FILE = path.join(AGNES_HOME, "config.json");
let MCP_FILE = path.join(AGNES_HOME, "mcp.json");
let SKILLS_DIR = path.join(AGNES_HOME, "skills");
let MEMORY_DIR = path.join(AGNES_HOME, "memory");
let SESSIONS_DIR = path.join(AGNES_HOME, "sessions");
let SESSIONS_INDEX_FILE = path.join(SESSIONS_DIR, "index.json");

function updatePaths(newRoot) {
  AGNES_HOME = newRoot;
  CONFIG_FILE = path.join(AGNES_HOME, "config.json");
  MCP_FILE = path.join(AGNES_HOME, "mcp.json");
  SKILLS_DIR = path.join(AGNES_HOME, "skills");
  MEMORY_DIR = path.join(AGNES_HOME, "memory");
  SESSIONS_DIR = path.join(AGNES_HOME, "sessions");
  SESSIONS_INDEX_FILE = path.join(SESSIONS_DIR, "index.json");
}

/**
 * 确保目录存在（带安全 fallback）
 */
function ensureDir(dirPath) {
  try {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  } catch (err) {
    if (err.code === "EPERM" || err.code === "EACCES") {
      const defaultUserAgnes = path.join(USER_HOME, ".agnes");
      const fallbackRoot = path.join(process.cwd(), ".agnes_local");
      console.warn(`[storageService] 访问 ${dirPath} 权限不足，回退到本地目录: ${fallbackRoot}`);
      updatePaths(fallbackRoot);
      const targetPath = dirPath.startsWith(defaultUserAgnes)
        ? dirPath.replace(defaultUserAgnes, fallbackRoot)
        : fallbackRoot;
      if (!fs.existsSync(targetPath)) {
        fs.mkdirSync(targetPath, { recursive: true });
      }
    } else {
      throw err;
    }
  }
}

/**
 * 安全读取 JSON 文件
 */
function readJsonSafe(filePath, fallback = {}) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    const content = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(content);
  } catch (err) {
    console.error(`[storageService] 读取 JSON 失败 (${filePath}):`, err.message);
    return fallback;
  }
}

/**
 * 安全写入 JSON 文件（格式化排版）
 */
function writeJsonSafe(filePath, data) {
  try {
    ensureDir(path.dirname(filePath));
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
    return true;
  } catch (err) {
    console.error(`[storageService] 写入 JSON 失败 (${filePath}):`, err.message);
    return false;
  }
}

/**
 * 初始化全局 ~/.agnes 目录结构与默认配置文件
 */
function initStorage() {
  ensureDir(AGNES_HOME);
  ensureDir(SKILLS_DIR);
  ensureDir(MEMORY_DIR);
  ensureDir(SESSIONS_DIR);

  // 1. 初始化 config.json
  if (!fs.existsSync(CONFIG_FILE)) {
    const defaultConfig = {
      api_key: "",
      base_url: "https://api.openai.com/v1",
      default_model: "gpt-4o",
      save_path: "",
      search_provider: "duckduckgo",
      search_api_key: "",
      search_max_results: 5,
      llm_models: [
        {
          id: "model_chat_default",
          model_id: "gpt-4o",
          name: "GPT-4o",
          type: "chat",
          provider: "openai",
          base_url: "https://api.openai.com/v1",
          api_key: "",
        },
        {
          id: "model_claude_default",
          model_id: "claude-3-5-sonnet-20241022",
          name: "Claude 3.5 Sonnet",
          type: "chat",
          provider: "custom",
          base_url: "https://api.anthropic.com/v1",
          api_key: "",
        },
        {
          id: "model_ollama_default",
          model_id: "qwen2.5-coder:7b",
          name: "Ollama Qwen 2.5 Coder",
          type: "chat",
          provider: "ollama",
          base_url: "http://localhost:11434/v1",
          api_key: "",
        },
      ],
    };
    writeJsonSafe(CONFIG_FILE, defaultConfig);
  }

  // 2. 初始化标准 mcp.json (完全兼容 Claude Desktop / Cursor 格式)
  if (!fs.existsSync(MCP_FILE)) {
    const defaultMcp = {
      mcpServers: {
        context7: {
          command: "npx",
          args: ["-y", "@upstash/context7-mcp"],
          env: {},
          description: "实时检索前沿开发文档与代码库示例",
          enabled: true,
        },
      },
    };
    writeJsonSafe(MCP_FILE, defaultMcp);
  }

  // 3. 初始化示例 Skill
  const defaultSkillPath = path.join(SKILLS_DIR, "code-review.md");
  if (!fs.existsSync(defaultSkillPath)) {
    const skillContent = `---
name: code-review
description: 对当前项目代码进行规范性、架构可维护性与潜在 Bug 审查
tools: [read_file, search_code, list_directory]
---

当用户要求进行代码审查或排查 Bug 时：
1. 先使用 list_directory 或 search_code 了解项目架构。
2. 使用 read_file 检查核心逻辑、异常边界处理与类型定义。
3. 提供条理清晰的问题定位与具体的修改对比建议。
`;
    fs.writeFileSync(defaultSkillPath, skillContent, "utf-8");
  }

  // 4. 初始化 Memory
  const memoryIndexPath = path.join(MEMORY_DIR, "MEMORY.md");
  if (!fs.existsSync(memoryIndexPath)) {
    const memoryIndexContent = `# Agnes AI Agent 记忆库索引

- [用户编码偏好与技术栈约定](user_profile.md)
`;
    fs.writeFileSync(memoryIndexPath, memoryIndexContent, "utf-8");
  }

  const userProfilePath = path.join(MEMORY_DIR, "user_profile.md");
  if (!fs.existsSync(userProfilePath)) {
    const profileContent = `---
name: user-profile
description: 用户偏好的开发环境、代码风格与语言习惯
category: user_preference
---

# 用户开发偏好
- 语言偏好: 中文回复
- 代码风格: 现代化 TypeScript / React 18 / Tailwind CSS / Node.js
- 架构原则: 模块高内聚低耦合，重视类型安全与边界异常捕获
`;
    fs.writeFileSync(userProfilePath, profileContent, "utf-8");
  }

  // 5. 初始化 sessions/index.json
  if (!fs.existsSync(SESSIONS_INDEX_FILE)) {
    writeJsonSafe(SESSIONS_INDEX_FILE, []);
  }

  console.log(`[storageService] 已就绪，根目录: ${AGNES_HOME}`);
}

// ─────────────────────────────────────────────────────────────
// 配置管理 (Config)
// ─────────────────────────────────────────────────────────────

function getAllConfig() {
  return readJsonSafe(CONFIG_FILE, {});
}

function getConfig(key) {
  const cfg = getAllConfig();
  return cfg[key] !== undefined ? cfg[key] : null;
}

function setConfig(key, value) {
  const cfg = getAllConfig();
  cfg[key] = value;
  return writeJsonSafe(CONFIG_FILE, cfg);
}

function getModels() {
  const cfg = getAllConfig();
  return cfg.llm_models || [];
}

function addModel(model) {
  const cfg = getAllConfig();
  if (!cfg.llm_models) cfg.llm_models = [];
  const idx = cfg.llm_models.findIndex((m) => m.id === model.id);
  if (idx >= 0) {
    cfg.llm_models[idx] = { ...cfg.llm_models[idx], ...model };
  } else {
    cfg.llm_models.push(model);
  }
  writeJsonSafe(CONFIG_FILE, cfg);
  return { success: true };
}

function deleteModel(modelId) {
  const cfg = getAllConfig();
  if (cfg.llm_models) {
    cfg.llm_models = cfg.llm_models.filter((m) => m.id !== modelId);
    writeJsonSafe(CONFIG_FILE, cfg);
  }
  return { success: true };
}

// ─────────────────────────────────────────────────────────────
// 会话与消息管理 (Sessions & Messages)
// ─────────────────────────────────────────────────────────────

function getSessions() {
  return readJsonSafe(SESSIONS_INDEX_FILE, []);
}

function getSessionFilePath(sessionId) {
  return path.join(SESSIONS_DIR, `${sessionId}.json`);
}

function saveSession(session) {
  const sessions = getSessions();
  const idx = sessions.findIndex((s) => s.id === session.id);
  const now = Date.now();

  const sessionSummary = {
    id: session.id,
    title: session.title || "新会话",
    model: session.model || "model_chat_default",
    work_dir: session.work_dir || null,
    updated_at: session.updated_at || now,
    created_at: session.created_at || now,
  };

  if (idx >= 0) {
    sessions[idx] = { ...sessions[idx], ...sessionSummary };
  } else {
    sessions.unshift(sessionSummary);
  }
  writeJsonSafe(SESSIONS_INDEX_FILE, sessions);

  // 保证单会话文件存在
  const filePath = getSessionFilePath(session.id);
  const detail = readJsonSafe(filePath, {
    ...sessionSummary,
    messages: [],
    outputs: [],
  });
  detail.title = sessionSummary.title;
  detail.model = sessionSummary.model;
  detail.work_dir = sessionSummary.work_dir;
  detail.updated_at = sessionSummary.updated_at;
  writeJsonSafe(filePath, detail);

  return { success: true, session: sessionSummary };
}

function deleteSession(sessionId) {
  let sessions = getSessions();
  sessions = sessions.filter((s) => s.id !== sessionId);
  writeJsonSafe(SESSIONS_INDEX_FILE, sessions);

  const filePath = getSessionFilePath(sessionId);
  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch (err) {
      console.error(`[storageService] 删除会话文件失败: ${err.message}`);
    }
  }
  return { success: true };
}

function getMessages(sessionId) {
  const filePath = getSessionFilePath(sessionId);
  const detail = readJsonSafe(filePath, { messages: [] });
  return detail.messages || [];
}

function addMessage(sessionId, message) {
  const filePath = getSessionFilePath(sessionId);
  const detail = readJsonSafe(filePath, {
    id: sessionId,
    messages: [],
    outputs: [],
  });

  const msgId = message.id || `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const fullMsg = {
    id: msgId,
    session_id: sessionId,
    role: message.role,
    content: message.content || "",
    tool_calls: message.tool_calls || null,
    tool_call_id: message.tool_call_id || null,
    created_at: message.created_at || Date.now(),
    metadata: message.metadata || null,
  };

  detail.messages.push(fullMsg);
  detail.updated_at = Date.now();
  writeJsonSafe(filePath, detail);

  // 同步更新 index.json 的 updated_at
  const sessions = getSessions();
  const sessionItem = sessions.find((s) => s.id === sessionId);
  if (sessionItem) {
    sessionItem.updated_at = detail.updated_at;
    writeJsonSafe(SESSIONS_INDEX_FILE, sessions);
  }

  return { success: true, message: fullMsg };
}

function deleteMessagesAfter(sessionId, timestamp) {
  const filePath = getSessionFilePath(sessionId);
  const detail = readJsonSafe(filePath, { messages: [] });
  detail.messages = detail.messages.filter((m) => m.created_at <= timestamp);
  writeJsonSafe(filePath, detail);
  return { success: true };
}

// ─────────────────────────────────────────────────────────────
// MCP 服务配置读取 (合并全局与项目级)
// ─────────────────────────────────────────────────────────────

function getMcpServers(workDir = null) {
  const globalMcp = readJsonSafe(MCP_FILE, { mcpServers: {} });
  let servers = { ...(globalMcp.mcpServers || {}) };

  // 若存在项目级 .agnes/mcp.json，就地合并
  if (workDir) {
    const projectMcpFile = path.join(workDir, ".agnes", "mcp.json");
    if (fs.existsSync(projectMcpFile)) {
      const projectMcp = readJsonSafe(projectMcpFile, { mcpServers: {} });
      servers = { ...servers, ...(projectMcp.mcpServers || {}) };
    }
  }

  // 格式化输出为数组供 UI 展示
  return Object.entries(servers).map(([key, item]) => ({
    id: key,
    name: key,
    command: item.command,
    args: item.args || [],
    env: item.env || {},
    description: item.description || "",
    enabled: item.enabled !== false,
  }));
}

function saveGlobalMcpServers(serversMap) {
  return writeJsonSafe(MCP_FILE, { mcpServers: serversMap });
}

// ─────────────────────────────────────────────────────────────
// 技能 (Skills) 扫描与读取
// ─────────────────────────────────────────────────────────────

function parseSkillMarkdown(filePath, scope = "global") {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const filename = path.basename(filePath);
    let name = filename.replace(/\.md$/i, "");
    let description = "";
    let tools = [];
    let promptBody = content;

    const frontmatterMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
    if (frontmatterMatch) {
      const yaml = frontmatterMatch[1];
      promptBody = frontmatterMatch[2].trim();

      const nameMatch = yaml.match(/name:\s*(.+)/);
      if (nameMatch) name = nameMatch[1].trim();

      const descMatch = yaml.match(/description:\s*(.+)/);
      if (descMatch) description = descMatch[1].trim();

      const toolsMatch = yaml.match(/tools:\s*\[(.*?)\]/);
      if (toolsMatch) {
        tools = toolsMatch[1]
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean);
      }
    }

    return {
      id: `${scope}:${name}`,
      name,
      description,
      tools,
      prompt: promptBody,
      scope,
      filePath,
    };
  } catch (err) {
    console.error(`[storageService] 解析 Skill 失败 (${filePath}):`, err.message);
    return null;
  }
}

function getSkills(workDir = null) {
  const skills = [];

  // 全局 Skills
  if (fs.existsSync(SKILLS_DIR)) {
    const files = fs.readdirSync(SKILLS_DIR);
    for (const file of files) {
      if (file.endsWith(".md")) {
        const item = parseSkillMarkdown(path.join(SKILLS_DIR, file), "global");
        if (item) skills.push(item);
      }
    }
  }

  // 项目级 Skills
  if (workDir) {
    const projectSkillsDir = path.join(workDir, ".agnes", "skills");
    if (fs.existsSync(projectSkillsDir)) {
      const files = fs.readdirSync(projectSkillsDir);
      for (const file of files) {
        if (file.endsWith(".md")) {
          const item = parseSkillMarkdown(path.join(projectSkillsDir, file), "project");
          if (item) skills.push(item);
        }
      }
    }
  }

  return skills;
}

// ─────────────────────────────────────────────────────────────
// 记忆库 (Memory) 读取
// ─────────────────────────────────────────────────────────────

function getMemories(workDir = null) {
  const memories = [];

  // 全局记忆
  if (fs.existsSync(MEMORY_DIR)) {
    const files = fs.readdirSync(MEMORY_DIR);
    for (const file of files) {
      if (file.endsWith(".md") && file !== "MEMORY.md") {
        const fp = path.join(MEMORY_DIR, file);
        const content = fs.readFileSync(fp, "utf-8");
        memories.push({
          id: `global:${file}`,
          name: file.replace(/\.md$/, ""),
          path: fp,
          content,
          scope: "global",
        });
      }
    }
  }

  // 项目级记忆
  if (workDir) {
    const projMemDir = path.join(workDir, ".agnes", "memory");
    if (fs.existsSync(projMemDir)) {
      const files = fs.readdirSync(projMemDir);
      for (const file of files) {
        if (file.endsWith(".md") && file !== "MEMORY.md") {
          const fp = path.join(projMemDir, file);
          const content = fs.readFileSync(fp, "utf-8");
          memories.push({
            id: `project:${file}`,
            name: file.replace(/\.md$/, ""),
            path: fp,
            content,
            scope: "project",
          });
        }
      }
    }
  }

  return memories;
}

// ─────────────────────────────────────────────────────────────
// 导出产物管理 (Outputs)
// ─────────────────────────────────────────────────────────────

function getSessionOutputs(sessionId) {
  const filePath = getSessionFilePath(sessionId);
  const detail = readJsonSafe(filePath, { outputs: [] });
  return detail.outputs || [];
}

function addSessionOutput(sessionId, outputItem) {
  const filePath = getSessionFilePath(sessionId);
  const detail = readJsonSafe(filePath, { outputs: [] });
  if (!detail.outputs) detail.outputs = [];

  const exists = detail.outputs.some((o) => o.filePath === outputItem.filePath);
  if (!exists) {
    detail.outputs.push({
      id: `out_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: outputItem.name,
      filePath: outputItem.filePath,
      fileType: outputItem.fileType || "document",
      createdAt: Date.now(),
    });
    writeJsonSafe(filePath, detail);
  }
  return detail.outputs;
}

// ─────────────────────────────────────────────────────────────
// 最近项目管理 (Recent Projects)
// ─────────────────────────────────────────────────────────────

function getRecentProjects() {
  const cfg = getAllConfig();
  if (Array.isArray(cfg.recent_projects) && cfg.recent_projects.length > 0) {
    return cfg.recent_projects;
  }
  return [
    { id: 'p1', name: 'notifycenter', path: '/opt/projects/notifycenter', hasChanges: true, isLoading: true },
    { id: 'p2', name: 'silence-fastapi', path: '/opt/projects/silence-fastapi', hasChanges: false, isLoading: false },
    { id: 'p3', name: 'alarmcenter-fastapi', path: '/opt/projects/alarmcenter-fastapi', hasChanges: false, isLoading: false },
  ];
}

function addRecentProject(proj) {
  const cfg = getAllConfig();
  if (!Array.isArray(cfg.recent_projects)) {
    cfg.recent_projects = getRecentProjects();
  }
  cfg.recent_projects = cfg.recent_projects.filter((p) => p.path !== proj.path);
  cfg.recent_projects.unshift(proj);
  if (cfg.recent_projects.length > 15) {
    cfg.recent_projects = cfg.recent_projects.slice(0, 15);
  }
  writeJsonSafe(CONFIG_FILE, cfg);
  return cfg.recent_projects;
}

module.exports = {
  AGNES_HOME,
  initStorage,
  getAllConfig,
  getConfig,
  setConfig,
  getModels,
  addModel,
  deleteModel,
  getRecentProjects,
  addRecentProject,
  getSessions,
  saveSession,
  deleteSession,
  getMessages,
  addMessage,
  deleteMessagesAfter,
  getMcpServers,
  saveGlobalMcpServers,
  getSkills,
  getMemories,
  getSessionOutputs,
  addSessionOutput,
};
