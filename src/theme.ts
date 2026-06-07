/**
 * 主题管理：亮色 / 暗色 / 随系统
 *
 * 策略：
 * - 暗色主题走默认（当前界面已有的硬编码深色值保持不变）
 * - 亮色主题通过注入 <style> 覆盖 Tailwind 生成的类
 * - 随系统则监听 prefers-color-scheme 媒体查询
 */

export type ThemeMode = "light" | "dark" | "system";

// 亮色主题覆盖样式表——覆盖所有常用的硬编码深色背景/边框/文字类
const LIGHT_STYLES = `
/* ─── 背景色 ─── */
html[data-theme="light"] .bg-\\[\\#1a1a1a\\] { background-color: #f1f5f9 !important; }
html[data-theme="light"] .bg-\\[\\#202020\\] { background-color: #ffffff !important; }
html[data-theme="light"] .bg-\\[\\#242424\\] { background-color: #ffffff !important; }
html[data-theme="light"] .bg-\\[\\#121212\\] { background-color: #f8fafc !important; }
html[data-theme="light"] .bg-\\[\\#1e1e1e\\] { background-color: #f8fafc !important; }
html[data-theme="light"] .bg-\\[\\#2a2a2a\\] { background-color: #ffffff !important; }
html[data-theme="light"] .bg-\\[\\#111\\] { background-color: #f8fafc !important; }
html[data-theme="light"] .bg-\\[\\#111111\\] { background-color: #e2e8f0 !important; }

/* ─── 文字色 ─── */
html[data-theme="light"] .text-gray-200 { color: #334155 !important; }
html[data-theme="light"] .text-gray-300 { color: #475569 !important; }
html[data-theme="light"] .text-gray-400 { color: #64748b !important; }
html[data-theme="light"] .text-gray-500 { color: #64748b !important; }
html[data-theme="light"] .text-white { color: #0f172a !important; }

/* ─── 边框 ─── */
html[data-theme="light"] .border-gray-700\\/50 { border-color: #e2e8f0 !important; }
html[data-theme="light"] .border-gray-700\\/60 { border-color: #e2e8f0 !important; }
html[data-theme="light"] .border-gray-700 { border-color: #e2e8f0 !important; }
html[data-theme="light"] .border-gray-600 { border-color: #cbd5e1 !important; }

/* ─── 侧边栏选中态：调整高亮颜色适配亮色背景 ─── */
html[data-theme="light"] .bg-indigo-600 { background-color: #6366f1 !important; }
html[data-theme="light"] .bg-indigo-600\\/20 { background-color: rgba(99,102,241,0.12) !important; }
html[data-theme="light"] .text-indigo-300 { color: #4f46e5 !important; }
html[data-theme="light"] .text-indigo-400 { color: #4338ca !important; }
html[data-theme="light"] .ring-indigo-400\\/40 { --tw-ring-color: rgba(99,102,241,0.3) !important; }

/* ─── 渐变背景覆盖 ─── */
html[data-theme="light"] .bg-\\[radial-gradient\\(circle_at_top_left\\,rgba\\(99\\,102\\,241\\,0\\.18\\)\\,transparent_34\\%\\)\\,radial-gradient\\(circle_at_top_right\\,rgba\\(34\\,211\\,238\\,0\\.10\\)\\,transparent_28\\%\\)\\] {
  background: radial-gradient(circle at top left, rgba(99,102,241,0.08), transparent 40%),
              radial-gradient(circle at top right, rgba(34,211,238,0.06), transparent 32%) !important;
}

/* ─── 图表/统计卡片 ─── */
html[data-theme="light"] .bg-gray-800\\/20 { background-color: rgba(248,250,252,0.9) !important; }
html[data-theme="light"] .bg-gray-800\\/50 { background-color: rgba(248,250,252,0.9) !important; }
html[data-theme="light"] .bg-gray-950\\/40 { background-color: #f8fafc !important; }
html[data-theme="light"] .bg-gray-950\\/30 { background-color: #ffffff !important; }

/* ─── 输入框 / 选择框 ─── */
html[data-theme="light"] input,
html[data-theme="light"] select,
html[data-theme="light"] textarea {
  color: #0f172a !important;
  background-color: #ffffff !important;
  border-color: #e2e8f0 !important;
}
html[data-theme="light"] input::placeholder { color: #94a3b8 !important; }

/* ─── 按钮样式覆盖 ─── */
html[data-theme="light"] button.bg-gray-700 { background-color: #f1f5f9 !important; color: #475569 !important; border: 1px solid #e2e8f0 !important; }
html[data-theme="light"] button.bg-gray-700:hover { background-color: #e2e8f0 !important; }

/* ─── 消息气泡 ─── */
html[data-theme="light"] .bg-gray-800 { background-color: #f8fafc !important; }
html[data-theme="light"] .bg-indigo-600\\/10 { background-color: rgba(99,102,241,0.08) !important; }

/* ─── Markdown 正文覆盖 ─── */
html[data-theme="light"] .markdown-body h1,
html[data-theme="light"] .markdown-body h2,
html[data-theme="light"] .markdown-body h3,
html[data-theme="light"] .markdown-body h4,
html[data-theme="light"] .markdown-body h5,
html[data-theme="light"] .markdown-body h6 {
  color: #0f172a !important;
}
html[data-theme="light"] .markdown-body p {
  color: #334155 !important;
}
html[data-theme="light"] .markdown-body code {
  background-color: #f1f5f9 !important;
  color: #4f46e5 !important;
  border: 1px solid #e2e8f0;
}
html[data-theme="light"] .markdown-body pre {
  background-color: #f8fafc !important;
  border-color: #e2e8f0 !important;
}
html[data-theme="light"] .markdown-body pre code {
  color: #0f172a !important;
  border: none !important;
}
html[data-theme="light"] .markdown-body blockquote {
  color: #64748b !important;
  border-left-color: #cbd5e1 !important;
}
html[data-theme="light"] .markdown-body th {
  background-color: #f8fafc !important;
  color: #0f172a !important;
}
html[data-theme="light"] .markdown-body td {
  color: #334155 !important;
}
html[data-theme="light"] .markdown-body th,
html[data-theme="light"] .markdown-body td {
  border-color: #e2e8f0 !important;
}
html[data-theme="light"] .markdown-body a {
  color: #4f46e5 !important;
}
html[data-theme="light"] .markdown-body a:hover {
  color: #4338ca !important;
}

/* ─── 表格/列表行悬停 ─── */
html[data-theme="light"] .hover\\:bg-gray-800\\/20:hover { background-color: rgba(241,245,249,0.8) !important; }
html[data-theme="light"] .hover\\:bg-gray-800:hover { background-color: #f8fafc !important; }

/* ─── 工具状态面板 ─── */
html[data-theme="light"] .bg-indigo-500\\/10 { background-color: rgba(99,102,241,0.08) !important; }
html[data-theme="light"] .border-indigo-500\\/20 { border-color: rgba(99,102,241,0.2) !important; }
`;

const STYLE_ID = "workbuddy-theme-override";

/** 获取当前生效的主题（解析 system 为实际亮/暗） */
export function resolveTheme(mode: ThemeMode): "light" | "dark" {
  if (mode === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }
  return mode;
}

/** 应用主题：设置 data-theme、注入/移除覆盖样式、同步系统监听 */
export function applyTheme(mode: ThemeMode): void {
  const effective = resolveTheme(mode);
  const html = document.documentElement;

  // 设置 data-theme 属性
  html.setAttribute("data-theme", effective);

  // 对 Tailwind dark mode class 的兼容
  if (effective === "dark") {
    html.classList.add("dark");
  } else {
    html.classList.remove("dark");
  }

  // 注入或移除亮色覆盖样式
  const existing = document.getElementById(STYLE_ID);
  if (effective === "light") {
    if (!existing) {
      const style = document.createElement("style");
      style.id = STYLE_ID;
      style.textContent = LIGHT_STYLES;
      document.head.appendChild(style);
    }
  } else {
    if (existing) {
      existing.remove();
    }
  }
}

/** 保存主题偏好到数据库配置 */
export async function saveTheme(mode: ThemeMode): Promise<boolean> {
  try {
    const api = (window as any).electronAPI;
    if (api?.setConfig) {
      await api.setConfig("theme", mode);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/** 从数据库加载主题偏好 */
export async function loadTheme(): Promise<ThemeMode> {
  try {
    const api = (window as any).electronAPI;
    if (api?.getConfig) {
      const saved = await api.getConfig("theme");
      if (saved === "light" || saved === "dark" || saved === "system") {
        return saved;
      }
    }
    return "system";
  } catch {
    return "system";
  }
}

/** 设置主题并持久化 */
export async function setTheme(mode: ThemeMode): Promise<void> {
  applyTheme(mode);
  await saveTheme(mode);
}

/** 初始化主题并注册系统偏好变化监听（随系统模式） */
export async function initTheme(): Promise<void> {
  const saved = await loadTheme();
  applyTheme(saved);

  // 监听系统偏好变化
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const handler = () => {
    // 重新读取配置，如果仍然是 system 模式则刷新
    loadTheme().then((mode) => {
      if (mode === "system") {
        applyTheme("system");
      }
    });
  };
  mq.addEventListener("change", handler);
}
