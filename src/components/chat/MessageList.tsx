import React, { useRef, useEffect, useState } from "react";
import { User, Bot, Copy, RotateCw, CheckCircle, AlertCircle, Globe } from "lucide-react";
import { Message } from "../../stores/chatStore";
import MarkdownContent from "../MarkdownContent";

interface Props {
  messages: Message[];
  isGenerating: boolean;
  activeToolCalls: ToolStatusEvent[];
  onCopy: (text: string) => void;
  onRetry: (msg: Message) => void;
}

const WaitingMessage: React.FC = () => (
  <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
    <div className="h-4 w-4 border-2 border-indigo-300/30 border-t-indigo-300 rounded-full animate-spin" />
    <span>正在生成回复，请稍候...</span>
  </div>
);

const MAX_PREVIEW_CHARS = 1400;

function formatValue(value: any): string {
  if (value === undefined) return "undefined";
  if (value === null) return "null";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function truncateText(text: string, maxChars = MAX_PREVIEW_CHARS): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}\n\n...（已截断，共 ${text.length} 字符）`;
}

const ToolStatusPanel: React.FC<{ events: ToolStatusEvent[] }> = ({ events }) => {
  const [collapsed, setCollapsed] = useState(false);
  if (events.length === 0) return null;

  const runningCount = events.filter((e) => e.status === "running").length;
  const failedCount = events.filter((e) => e.status === "done" && !e.result?.success).length;
  const completedCount = events.length - runningCount - failedCount;

  return (
    <div className="mb-3 w-full max-w-[820px]">
      <div className="overflow-hidden rounded-xl border border-indigo-500/20 bg-indigo-500/5">
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-indigo-500/10"
        >
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-indigo-300">
              <span>工具调用记录（{events.length} 次）</span>
              {runningCount > 0 && <span className="rounded-full bg-indigo-500/15 px-2 py-0.5 text-indigo-200">运行中 {runningCount}</span>}
              {completedCount > 0 && <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-emerald-300">成功 {completedCount}</span>}
              {failedCount > 0 && <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-red-300">失败 {failedCount}</span>}
            </div>
            <div className="mt-1 text-[11px] text-gray-500">
              可查看每次工具调用的参数和返回结果
            </div>
          </div>
          <span className="rounded-md border border-gray-700 px-2 py-1 text-[11px] text-gray-400">
            {collapsed ? "展开" : "收起"}
          </span>
        </button>

        {!collapsed && (
          <div className="max-h-72 overflow-y-auto border-t border-indigo-500/10 p-3">
            <div className="space-y-3">
              {events.map((event, idx) => {
                const isRunning = event.status === "running";
                const toolLabels: Record<string, string> = {
                  read_file: "读取文件",
                  search_code: "搜索代码",
                  list_directory: "浏览目录",
                  write_file: "写入文件",
                  run_command: "执行命令",
                  web_search: "网页搜索",
                  web_fetch: "抓取网页",
                };
                const label = toolLabels[event.tool] || event.tool;

                return (
                  <div
                    key={`${event.tool}-${event.callId || idx}`}
                    className="rounded-lg border border-gray-700/70 bg-[#151515]/80 p-3"
                  >
                    <div className="flex items-center gap-2 text-xs">
                      {isRunning ? (
                        <div className="h-3.5 w-3.5 border-2 border-indigo-400/30 border-t-indigo-400 rounded-full animate-spin" />
                      ) : event.result?.success ? (
                        <CheckCircle size={14} className="text-emerald-300" />
                      ) : (
                        <AlertCircle size={14} className="text-red-300" />
                      )}
                      <span className="font-medium text-gray-200">{label}</span>
                      <span className={isRunning ? "text-indigo-300" : event.result?.success ? "text-emerald-300" : "text-red-300"}>
                        {isRunning ? "处理中" : event.result?.success ? "完成" : "失败"}
                      </span>
                    </div>

                    {event.args && (
                      <div className="mt-2 rounded-md bg-gray-950/60 p-2">
                        <div className="mb-1 text-[10px] font-medium text-gray-500">参数</div>
                        <pre className="max-h-20 overflow-y-auto whitespace-pre-wrap break-words text-[11px] leading-relaxed text-gray-300">
                          {truncateText(formatValue(event.args), 800)}
                        </pre>
                      </div>
                    )}

                    {event.result && (
                      <div className="mt-2 rounded-md bg-gray-950/60 p-2">
                        <div className="mb-1 text-[10px] font-medium text-gray-500">返回结果</div>
                        <pre className="max-h-44 overflow-y-auto whitespace-pre-wrap break-words text-[11px] leading-relaxed text-gray-300">
                          {truncateText(formatValue(event.result), MAX_PREVIEW_CHARS)}
                        </pre>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const ReferenceLinks: React.FC<{ metadata: any[] }> = ({ metadata }) => (
  <div className="mb-2 w-full max-w-xl text-xs">
    <details className="group border border-gray-755 rounded-xl bg-[#202020] overflow-hidden">
      <summary className="flex items-center justify-between p-2.5 font-medium text-gray-400 cursor-pointer hover:bg-gray-800/40 outline-none select-none transition-colors">
        <div className="flex items-center gap-1.5">
          <Globe size={13} className="text-indigo-400" />
          <span>参考网页来源 ({metadata.length})</span>
        </div>
        <span className="text-[10px] text-gray-500 transition-transform duration-200 group-open:rotate-180">▼</span>
      </summary>
      <div className="p-3 border-t border-gray-750/70 space-y-2 bg-[#1a1a1a]/30">
        {metadata.map((ref: any, idx: number) => {
          let hostname = "";
          try {
            hostname = new URL(ref.url).hostname;
          } catch (e) {
            hostname = "link";
          }
          return (
            <a
              key={idx}
              href={ref.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between hover:bg-indigo-600/10 p-1.5 rounded-lg text-gray-300 hover:text-indigo-400 transition-all font-medium border border-transparent hover:border-indigo-500/20 group/link"
            >
              <span className="truncate max-w-[80%] flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-[#1a1a1a] text-[10px] flex items-center justify-center font-bold text-indigo-400 flex-shrink-0">
                  {idx + 1}
                </span>
                <span className="truncate font-sans text-xs">{ref.title || ref.url}</span>
              </span>
              <span className="text-[10px] text-gray-500 font-mono group-hover/link:text-indigo-400">
                {hostname} ↗
              </span>
            </a>
          );
        })}
      </div>
    </details>
  </div>
);

const MessageBubble: React.FC<{
  msg: Message;
  isLast: boolean;
  activeToolCalls: ToolStatusEvent[];
  containerWidth: number;
  onCopy: (text: string) => void;
  onRetry: (msg: Message) => void;
}> = ({ msg, isLast, activeToolCalls, containerWidth, onCopy, onRetry, isGenerating }) => (
  <div
    className={`group flex gap-4 ${msg.role === "user" ? "ml-auto flex-row-reverse" : "mr-auto"}`}
    style={{
      maxWidth: containerWidth ? `${Math.min(containerWidth * 0.9, 1200)}px` : "85%",
    }}
  >
    <div
      className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-1 ${
        msg.role === "user" ? "bg-indigo-500" : "bg-gray-700"
      }`}
    >
      {msg.role === "user" ? (
        <User size={18} className="text-white" />
      ) : (
        <Bot size={18} className="text-white" />
      )}
    </div>
    <div className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"} max-w-full`}>
      {msg.role === "assistant" && isGenerating && isLast && !msg.content.trim() && (
        <div className="mb-3">
          <WaitingMessage />
        </div>
      )}

      {/* 工具调用状态卡片 */}
      {msg.role === "assistant" && activeToolCalls.length > 0 && isLast && (
        <ToolStatusPanel events={activeToolCalls} />
      )}

      {/* 网页引用来源列表 */}
      {msg.role === "assistant" && Array.isArray(msg.metadata) && msg.metadata.length > 0 && (
        <ReferenceLinks metadata={msg.metadata} />
      )}

      <div
        className={`px-4 py-3 rounded-2xl text-[15px] leading-relaxed shadow-sm break-words w-full ${
          msg.role === "user"
            ? "bg-indigo-600 text-white rounded-tr-none whitespace-pre-wrap"
            : "bg-[#2a2a2a] text-gray-200 border border-gray-700/50 rounded-tl-none"
        }`}
      >
        {msg.role === "user" ? (
          msg.content
        ) : (
          <MarkdownContent content={msg.content} />
        )}
      </div>

      {msg.role === "user" && (
        <div className="flex gap-2 mt-1 px-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onCopy(msg.content)}
            className="p-1 hover:bg-gray-800 rounded text-gray-500 hover:text-gray-300 transition-colors"
            title="复制"
          >
            <Copy size={13} />
          </button>
          <button
            onClick={() => onRetry(msg)}
            className="p-1 hover:bg-gray-800 rounded text-gray-500 hover:text-gray-300 transition-colors"
            title="重试"
          >
            <RotateCw size={13} />
          </button>
        </div>
      )}
    </div>
  </div>
);

const MessageList: React.FC<Props> = ({ messages, isGenerating, activeToolCalls, onCopy, onRetry }) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver((entries) => {
      if (entries.length > 0) {
        setContainerWidth(entries[0].contentRect.width);
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  if (messages.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500">
        请在左侧选择或创建一个会话
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto p-6 space-y-6">
      {messages.map((msg, idx) => (
        <MessageBubble
          key={msg.id}
          msg={msg}
          isLast={idx === messages.length - 1}
          activeToolCalls={activeToolCalls}
          containerWidth={containerWidth}
          onCopy={onCopy}
          onRetry={onRetry}
          isGenerating={isGenerating}
        />
      ))}
      <div ref={messagesEndRef} />
    </div>
  );
};

export default MessageList;