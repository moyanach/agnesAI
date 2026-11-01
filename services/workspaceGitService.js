const { execFile } = require("child_process");
const fs = require("fs");
const path = require("path");

/**
 * 获取指定目录的 Git 状态和改动行数摘要
 * @param {string} workDir
 * @returns {Promise<{isGit: boolean, branch?: string, insertions: number, deletions: number, modifiedFiles: Array<{path: string, status: string}>}>}
 */
function getWorkspaceGitStatus(workDir) {
  return new Promise((resolve) => {
    if (!workDir || !fs.existsSync(workDir)) {
      return resolve({
        isGit: false,
        insertions: 0,
        deletions: 0,
        modifiedFiles: [],
      });
    }

    // 检查是否存在 .git 目录
    const gitDir = path.join(workDir, ".git");
    if (!fs.existsSync(gitDir)) {
      return resolve({
        isGit: false,
        insertions: 0,
        deletions: 0,
        modifiedFiles: [],
      });
    }

    // 1. 获取当前分支
    execFile(
      "git",
      ["rev-parse", "--abbrev-ref", "HEAD"],
      { cwd: workDir },
      (err, branchStdout) => {
        const branch = !err && branchStdout ? branchStdout.trim() : "main";

        // 2. 获取简要修改文件列表
        execFile(
          "git",
          ["status", "--short"],
          { cwd: workDir },
          (errStatus, statusStdout) => {
            const modifiedFiles = [];
            if (!errStatus && statusStdout) {
              const lines = statusStdout.trim().split("\n");
              for (const line of lines) {
                if (!line) continue;
                const status = line.slice(0, 2).trim();
                const filePath = line.slice(3).trim();
                modifiedFiles.push({ path: filePath, status });
              }
            }

            // 3. 获取 diff 增删行数统计
            execFile(
              "git",
              ["diff", "--shortstat"],
              { cwd: workDir },
              (errDiff, diffStdout) => {
                let insertions = 0;
                let deletions = 0;

                if (!errDiff && diffStdout) {
                  // e.g., " 3 files changed, 42830 insertions(+), 536 deletions(-)"
                  const insertMatch = diffStdout.match(/(\d+)\s+insertion/);
                  const deleteMatch = diffStdout.match(/(\d+)\s+deletion/);
                  if (insertMatch) insertions = parseInt(insertMatch[1], 10);
                  if (deleteMatch) deletions = parseInt(deleteMatch[1], 10);
                }

                // 如果未暂存区没有，再检查暂存区
                if (insertions === 0 && deletions === 0 && modifiedFiles.length > 0) {
                  execFile(
                    "git",
                    ["diff", "--cached", "--shortstat"],
                    { cwd: workDir },
                    (errCached, cachedStdout) => {
                      if (!errCached && cachedStdout) {
                        const insM = cachedStdout.match(/(\d+)\s+insertion/);
                        const delM = cachedStdout.match(/(\d+)\s+deletion/);
                        if (insM) insertions = parseInt(insM[1], 10);
                        if (delM) deletions = parseInt(delM[1], 10);
                      }
                      resolve({
                        isGit: true,
                        branch,
                        insertions,
                        deletions,
                        modifiedFiles,
                      });
                    }
                  );
                } else {
                  resolve({
                    isGit: true,
                    branch,
                    insertions,
                    deletions,
                    modifiedFiles,
                  });
                }
              }
            );
          }
        );
      }
    );
  });
}

module.exports = {
  getWorkspaceGitStatus,
};
