/**
 * langchainAgent — LangChain 工具封装层
 *
 * 职责：
 * 1. 使用 LangChain 的 StructuredTool 创建增强版工具
 * 2. 提供 OpenAI-compatible 工具定义（兼容现有 toolRegistry 格式）
 * 3. 提供工具执行入口
 *
 * 架构说明：
 * 当前 LangChain v1.4 使用 middleware-based agent 模式，
 * 与现有 SSE 流式循环不兼容。因此采用混合策略：
 * - 工具定义 = LangChain StructuredTool（schema 校验、结构化输出）
 * - 工具循环 = 现有 main.js 的自定义循环（已验证稳定的 SSE 流式）
 * - 系统提示词 = toolRegistry 当前使用的格式
 */

const { ReadFileTool, WriteFileTool, ListDirectoryTool, SearchCodeTool } = require("./tools/fileTools");
const { WebSearchTool, WebFetchTool } = require("./tools/webTools");
const { RunCommandTool } = require("./tools/shellTools");
const { performWebSearch } = require("./tools/webTools");

const SYSTEM_PROMPT = `【可用工具列表】
你可以使用以下工具来帮助用户完成任务。当用户的问题涉及项目文件、代码或执行命令时，请主动使用适当的工具。

- **read_file**: 读取项目文件的内容。支持任意文本文件，自动检测编码。适合查看源代码、配置文件、文档、数据文件等。
- **search_code**: 搜索项目代码中的关键字、函数名、变量名、错误信息等。使用 ripgrep 引擎，支持正则表达式。适合定位代码定义、查找引用。
- **list_directory**: 列出项目目录中的文件和子目录。适合浏览项目结构、查找文件。自动跳过 node_modules、dist、.git 等目录。
- **write_file**: 创建新文件或修改已有文件的内容。请在写入前先用 read_file 确认现有内容。注意：危险操作，需要用户确认。
- **run_command**: 在项目目录中执行 Shell 命令。适合运行构建、测试、安装依赖、git 操作等开发命令。注意：危险操作，需要用户确认。
- **web_search**: 搜索互联网获取实时信息。适合查询新闻、最新动态、专业知识、技术文档、实时数据等。搜索后自动爬取前3个结果返回正文摘要。
- **web_fetch**: 抓取指定网页的内容并返回文本摘要。适合阅读在线文档、博客文章、新闻等。

【使用规则】
1. 先使用 list_directory 或 search_code 了解项目结构
2. 使用 read_file 读取相关文件内容
3. 如果用户要求修改文件，先用 read_file 确认现有内容
4. 修改或创建文件时使用 write_file
5. 运行命令时使用 run_command
6. 如果需要实时信息，使用 web_search / web_fetch
7. write_file 和 run_command 是危险操作，请让用户确认后再执行`;

/**
 * 创建所有增强工具的列表
 * @param {object} [searchConfig] - 搜索配置 { provider, apiKey, maxResults }
 * @returns {Array<{name:string, description:string, execute:Function, parameters:object}>}
 */
function createTools(searchConfig) {
  const tools = [
    new ReadFileTool(),
    new WriteFileTool(),
    new ListDirectoryTool(),
    new SearchCodeTool(),
    new RunCommandTool(),
    new WebSearchTool(searchConfig),
    new WebFetchTool(),
  ];
  return tools;
}

/**
 * 将 LangChain StructuredTool 转换为 OpenAI Function Calling 格式
 * @param {StructuredTool} tool
 * @returns {{type:'function', function:{name:string, description:string, parameters:object}}}
 */
function toolToFunctionDef(tool) {
  // StructuredTool 的 schema 是 Zod 对象，需要转为 JSON Schema
  let parameters = { type: "object", properties: {}, required: [] };

  const schema = tool.schema;
  if (schema && typeof schema === "object" && schema._def) {
    // ZodObject → JSON Schema
    const shape = schema._def?.shape?.();
    if (shape) {
      for (const [key, zodField] of Object.entries(shape)) {
        const fieldDef = zodField._def;
        let jsonType = "string";
        if (fieldDef.typeName === "ZodNumber") jsonType = "number";
        else if (fieldTypeName(fieldDef) === "ZodBoolean") jsonType = "boolean";
        else if (fieldTypeName(fieldDef) === "ZodArray") jsonType = "array";

        parameters.properties[key] = {
          type: jsonType,
          description: zodField.description || "",
        };

        // Check if optional
        const isOptional = fieldDef.typeName === "ZodOptional" ||
          (zodField.isOptional && zodField.isOptional());
        if (!isOptional && fieldDef.typeName !== "ZodOptional") {
          const checks = fieldDef.checks || [];
          if (!checks.some(c => c.kind === "optional")) {
            // default() implies optional
            if (!fieldDef.defaultValue) {
              if (!parameters.required.includes(key)) {
                parameters.required.push(key);
              }
            }
          }
        }
      }
    }
  }

  return {
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters,
    },
  };
}

function fieldTypeName(fieldDef) {
  // Handle ZodOptional wrapping
  if (fieldDef.typeName === "ZodOptional") {
    return fieldDef.innerType?._def?.typeName || "ZodString";
  }
  return fieldDef.typeName;
}

/**
 * 获取所有工具的 OpenAI Function Calling 定义
 * @param {object} [searchConfig]
 * @returns {Array<{type:string, function:{...}}>}
 */
function getToolDefinitions(searchConfig) {
  return createTools(searchConfig).map(toolToFunctionDef);
}

/**
 * 生成系统提示词（追加到 system message 末尾）
 */
function getSystemPrompt() {
  return SYSTEM_PROMPT;
}

module.exports = {
  createTools,
  getToolDefinitions,
  getSystemPrompt,
  toolToFunctionDef,
};