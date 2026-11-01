import { useState, useCallback } from "react";
import { useChatStore } from "../stores/chatStore";

interface StreamCallbacks {
  onToolStatus?: (status: {
    tool: string;
    status: "running" | "done";
    args: any;
    result?: any;
    callId?: string;
  }) => void;
}

function parseErrorDetails(err: string) {
  let parsed: any = null;
  try {
    parsed = JSON.parse(err);
  } catch {
    parsed = null;
  }

  if (!parsed || parsed.type !== "HTTP_ERROR") {
    return {
      summary: err,
      details: `\`\`\`text\n${err}\n\`\`\``,
    };
  }

  const status = parsed.status || "未知状态";
  const statusText = parsed.statusText || "";
  const model = parsed.model || "未知模型";
  const toolRound = parsed.toolRound ?? "未知";
  const url = parsed.url || "";
  const roles = Array.isArray(parsed.requestBody?.messageRoles)
    ? parsed.requestBody.messageRoles.join(" → ")
    : "";
  const toolsCount = parsed.requestBody?.toolsCount ?? 0;
  const toolChoice = parsed.requestBody?.toolChoice ?? "未设置";
  const responseBody = parsed.responseBody || "";

  return {
    summary: statusText ? `HTTP 错误: ${status} ${statusText}` : `HTTP 错误: ${status}`,
    details: [
      `<details open>`,
      `<summary>查看错误详情</summary>`,
      "",
      `- 状态: ${status}`,
      statusText ? `- 状态说明: ${statusText}` : "",
      `- URL: ${url}`,
      `- 模型: ${model}`,
      `- 工具轮次: ${toolRound}`,
      `- 工具数量: ${toolsCount}`,
      `- tool_choice: ${toolChoice}`,
      roles ? `- 消息角色链: ${roles}` : "",
      "",
      "```json",
      responseBody,
      "```",
      "",
      "</details>",
    ].filter(Boolean).join("\n"),
  };
}

function formatErrorContent(err: string) {
  const { summary, details } = parseErrorDetails(err);
  return `\n\n[生成失败: ${summary}]\n\n${details}`;
}

export function useStreamChat() {
  const [isGenerating, setIsGenerating] = useState(false);
  const {
    activeSessionId,
    messages,
    addMessage,
    appendMessageDelta,
    saveMessageToDb,
    updateMessageMetadata,
    truncateMessages,
    setContextMetrics,
    refreshOutputs,
  } = useChatStore();

  const sendMessage = useCallback(
    async (
      text: string,
      selectedModel: string,
      enableTools: boolean,
      callbacks?: StreamCallbacks,
    ) => {
      if (!activeSessionId || !text.trim()) return;

      setIsGenerating(true);

      const userMsg = {
        id: crypto.randomUUID(),
        role: "user" as const,
        content: text.trim(),
        createdAt: Date.now(),
      };
      await addMessage(activeSessionId, userMsg);

      const assistantMsgId = crypto.randomUUID();
      const assistantMsg = {
        id: assistantMsgId,
        role: "assistant" as const,
        content: "",
        createdAt: Date.now(),
      };
      await addMessage(activeSessionId, assistantMsg, true);

      const currentMsgs = messages[activeSessionId] || [];
      const contextMsgs = [...currentMsgs, userMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      let accumulatedContent = "";

      if (window.electronAPI?.streamChat) {
        window.electronAPI.streamChat(
          activeSessionId,
          contextMsgs,
          selectedModel,
          enableTools,
          (delta: string) => {
            accumulatedContent += delta;
            appendMessageDelta(activeSessionId, assistantMsgId, delta);
          },
          (metadata: any) => {
            setIsGenerating(false);
            saveMessageToDb(activeSessionId, {
              id: assistantMsgId,
              role: "assistant",
              content: accumulatedContent,
              createdAt: Date.now(),
              metadata: metadata?.length > 0 ? metadata : null,
            });
            updateMessageMetadata(activeSessionId, assistantMsgId, metadata);
          },
          (err: string) => {
            const errorContent = formatErrorContent(err);
            accumulatedContent += errorContent;
            appendMessageDelta(activeSessionId, assistantMsgId, errorContent);
            setIsGenerating(false);
            saveMessageToDb(activeSessionId, {
              id: assistantMsgId,
              role: "assistant",
              content: accumulatedContent,
              createdAt: Date.now(),
            });
          },
          (statusData: any) => {
            callbacks?.onToolStatus?.(statusData);
          },
          (metrics: any) => {
            setContextMetrics(metrics);
          },
          () => {
            refreshOutputs(activeSessionId);
          }
        );
      } else {
        setIsGenerating(false);
      }
    },
    [
      activeSessionId,
      messages,
      addMessage,
      appendMessageDelta,
      saveMessageToDb,
      updateMessageMetadata,
      setContextMetrics,
      refreshOutputs,
    ],
  );

  const retryMessage = useCallback(
    async (
      msgId: string,
      selectedModel: string,
      enableTools: boolean,
      callbacks?: StreamCallbacks,
    ) => {
      if (!activeSessionId || !window.electronAPI?.streamChat) return;
      setIsGenerating(true);

      try {
        await truncateMessages(activeSessionId, msgId);

        const assistantMsgId = crypto.randomUUID();
        const assistantMsg = {
          id: assistantMsgId,
          role: "assistant" as const,
          content: "",
          createdAt: Date.now(),
        };
        await addMessage(activeSessionId, assistantMsg, true);

        const keptMsgs = (messages[activeSessionId] || []).map((m) => ({
          role: m.role,
          content: m.content,
        }));

        let accumulatedContent = "";

        window.electronAPI.streamChat(
          activeSessionId,
          keptMsgs,
          selectedModel,
          enableTools,
          (delta: string) => {
            accumulatedContent += delta;
            appendMessageDelta(activeSessionId, assistantMsgId, delta);
          },
          (metadata: any) => {
            setIsGenerating(false);
            saveMessageToDb(activeSessionId, {
              id: assistantMsgId,
              role: "assistant",
              content: accumulatedContent,
              createdAt: Date.now(),
              metadata: metadata?.length > 0 ? metadata : null,
            });
            updateMessageMetadata(activeSessionId, assistantMsgId, metadata);
          },
          (err: string) => {
            const errorContent = formatErrorContent(err);
            accumulatedContent += errorContent;
            appendMessageDelta(activeSessionId, assistantMsgId, errorContent);
            setIsGenerating(false);
            saveMessageToDb(activeSessionId, {
              id: assistantMsgId,
              role: "assistant",
              content: accumulatedContent,
              createdAt: Date.now(),
            });
          },
          (statusData: any) => {
            callbacks?.onToolStatus?.(statusData);
          },
          (metrics: any) => {
            setContextMetrics(metrics);
          },
          () => {
            refreshOutputs(activeSessionId);
          }
        );
      } catch (err) {
        console.error("重试失败:", err);
        setIsGenerating(false);
      }
    },
    [
      activeSessionId,
      messages,
      addMessage,
      appendMessageDelta,
      saveMessageToDb,
      updateMessageMetadata,
      truncateMessages,
      setContextMetrics,
      refreshOutputs,
    ],
  );

  return { isGenerating, sendMessage, retryMessage };
}
