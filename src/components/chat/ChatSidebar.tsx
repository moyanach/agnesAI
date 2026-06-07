import React from "react";
import { MessageSquare, Hash, Cpu, Globe, Clock, User, Bot } from "lucide-react";
import { Session, Message } from "../../stores/chatStore";

interface Props {
  session: Session | undefined;
  messages: Message[];
}

function estimateTokens(text: string): number {
  const cnChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  const enWords = text
    .replace(/[\u4e00-\u9fff]/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;
  const punct = (text.match(/[,.!?;:，。！？；：""''（）()【】]/g) || []).length;
  return Math.round(cnChars * 2 + enWords * 1.3 + punct * 0.5);
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${mm}-${dd} ${hh}:${mi}`;
}

const ChatSidebar: React.FC<Props> = ({ session, messages }) => {
  const totalTokens = messages.reduce((sum, m) => sum + estimateTokens(m.content), 0);
  const userCount = messages.filter((m) => m.role === "user").length;
  const assistantCount = messages.filter((m) => m.role === "assistant").length;

  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-gray-600">
        <MessageSquare size={32} className="mb-2 opacity-30" />
        <span className="text-xs">未选择会话</span>
      </div>
    );
  }

  const infoItems = [
    {
      icon: <MessageSquare size={14} />,
      label: "总消息数",
      value: `${messages.length} 条`,
    },
    {
      icon: <User size={14} />,
      label: "用户消息",
      value: `${userCount} 条`,
    },
    {
      icon: <Bot size={14} />,
      label: "助手回复",
      value: `${assistantCount} 条`,
    },
    {
      icon: <Cpu size={14} />,
      label: "Token 估算",
      value: `${totalTokens.toLocaleString()} tokens`,
    },
    {
      icon: <Hash size={14} />,
      label: "会话 ID",
      value: session.id.substring(0, 8) + "...",
      mono: true,
    },
    {
      icon: <Clock size={14} />,
      label: "更新时间",
      value: formatDate(session.updatedAt),
    },
  ];

  return (
    <>
      {/* 会话标题 */}
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-gray-200 truncate">
          {session.title}
        </h3>
      </div>

      {/* 信息统计 */}
      <div className="space-y-1">
        {infoItems.map((item, i) => (
          <div
            key={i}
            className={`flex items-center justify-between px-2.5 py-2 rounded-md text-xs ${
              item.highlight
                ? "bg-indigo-600/10 text-indigo-400"
                : "text-gray-400 hover:bg-gray-800/50"
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="flex-shrink-0 opacity-60">{item.icon}</span>
              <span>{item.label}</span>
            </div>
            <span
              className={`font-medium ${
                item.mono ? "font-mono text-[10px]" : ""
              } ${item.highlight ? "text-indigo-300" : "text-gray-300"}`}
            >
              {item.value}
            </span>
          </div>
        ))}
      </div>

      {/* Token 分布柱状条 */}
      {messages.length > 0 && (
        <div className="mt-5">
          <span className="text-[10px] text-gray-500 font-medium block mb-2">
            消息占比
          </span>
          <div className="h-2 rounded-full bg-gray-800 overflow-hidden flex">
            <div
              className="h-full bg-indigo-500 transition-all"
              style={{
                width: `${
                  totalTokens > 0
                    ? Math.round(
                        (messages
                          .filter((m) => m.role === "user")
                          .reduce((s, m) => s + estimateTokens(m.content), 0) /
                          totalTokens) *
                          100
                      )
                    : 0
                }%`,
              }}
            />
            <div
              className="h-full bg-emerald-500 transition-all"
              style={{
                width: `${
                  totalTokens > 0
                    ? Math.round(
                        (messages
                          .filter((m) => m.role === "assistant")
                          .reduce((s, m) => s + estimateTokens(m.content), 0) /
                          totalTokens) *
                          100
                      )
                    : 0
                }%`,
              }}
            />
          </div>
          <div className="flex justify-between mt-1.5 text-[9px] text-gray-500">
            <span>用户 ({(totalTokens > 0
              ? Math.round(
                  (messages
                    .filter((m) => m.role === "user")
                    .reduce((s, m) => s + estimateTokens(m.content), 0) /
                    totalTokens) *
                    100
                )
              : 0
            )}%)</span>
            <span>助手 ({(totalTokens > 0
              ? Math.round(
                  (messages
                    .filter((m) => m.role === "assistant")
                    .reduce((s, m) => s + estimateTokens(m.content), 0) /
                    totalTokens) *
                    100
                )
              : 0
            )}%)</span>
          </div>
        </div>
      )}
    </>
  );
};

export default ChatSidebar;
