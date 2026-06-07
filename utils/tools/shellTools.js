/**
 * shellTools — 基于 LangChain StructuredTool 的 Shell 命令执行工具
 *
 * 保留路径安全校验，增强：输出截断、超时控制、错误恢复。
 */

const { execSync } = require("child_process");
const path = require("path");
const { z } = require("zod");
const { StructuredTool } = require("@langchain/core/tools");
const { PROJECT_ROOT } = require("./fileTools");

function resolveRoot(workDir) {
  if (workDir) {
    return path.resolve(workDir);
  }
  return PROJECT_ROOT;
}

function isPathAllowed(targetPath, rootPath) {
  const resolved = path.resolve(targetPath);
  const resolvedRoot = path.resolve(rootPath);
  const relativePath = path.relative(resolvedRoot, resolved);
  return relativePath === "" || (!relativePath.startsWith("..") && !path.isAbsolute(relativePath));
}

// ─── 工具: run_command ───────────────────────────────────────

class RunCommandTool extends StructuredTool {
  constructor() {
    super();
    this.name = "run_command";
    this.description = "在项目目录中执行 Shell 命令。适合运行构建、测试、安装依赖、git 操作等开发命令。注意：危险操作，需要用户确认。";
    this.schema = z.object({
      command: z.string().describe("要执行的 Shell 命令"),
      description: z.string().describe("命令说明，解释为什么需要执行这条命令及预期的效果"),
      timeout: z.number().optional().default(30).describe("超时时间（秒，默认 30）"),
      cwd: z.string().optional().describe("工作目录（可选，默认项目根目录）"),
    });
  }

  async _call({ command, description, timeout = 30, cwd, __workDir }) {
    const workDirResolved = resolveRoot(__workDir);

    const workDir = cwd ? (() => {
      const resolved = require("path").resolve(workDirResolved, cwd);
      if (!isPathAllowed(resolved, workDirResolved)) throw new Error(`工作目录超出工作范围: ${cwd}`);
      return resolved;
    })() : workDirResolved;

    const timeoutMs = timeout * 1000;
    try {
      const stdout = execSync(command, {
        cwd: workDir,
        encoding: "utf-8",
        maxBuffer: 10 * 1024 * 1024,
        timeout: timeoutMs,
      });
      return JSON.stringify({
        success: true,
        command,
        description,
        exitCode: 0,
        stdout: stdout.substring(0, 5000),
        truncated: stdout.length > 5000,
      });
    } catch (err) {
      return JSON.stringify({
        success: false,
        command,
        description,
        exitCode: err.status || -1,
        stdout: (err.stdout || "").substring(0, 5000),
        stderr: (err.stderr || "").substring(0, 2000),
        error: err.message,
        truncated: (err.stdout || "").length > 5000,
      });
    }
  }
}

module.exports = {
  RunCommandTool,
};