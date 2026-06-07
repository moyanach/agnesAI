import React, { useState, useEffect } from "react";
import { PanelRight } from "lucide-react";
import { useChatStore } from "../stores/chatStore";
import { useStreamChat } from "../hooks/useStreamChat";
import { useAppStore } from "../stores/appStore";
import SessionList from "../components/chat/SessionList";
import ChatHeader from "../components/chat/ChatHeader";
import MessageList from "../components/chat/MessageList";
import MessageInput from "../components/chat/MessageInput";
import RightSidebar from "../components/RightSidebar";
import ChatSidebar from "../components/chat/ChatSidebar";

declare global {
  interface Window {
    electronAPI: {
      dbGetModels: () => Promise<any[]>;
      streamChat: (
        sessionId: string,
        messages: any[],
        model: string,
        enableTools: boolean,
        onData: (delta: string) => void,
        onEnd: (metadata: any) => void,
        onError: (err: string) => void,
        onToolStatus: (statusData: any) => void,
      ) => void;
    };
  }
}

const ChatView: React.FC = () => {
  const {
    sessions,
    activeSessionId,
    messages,
    addSession,
    setActiveSession,
    deleteSession,
    initStore,
    updateSessionModel,
    updateSessionTitle,
    setSessionWorkDir,
  } = useChatStore();

  const { activeView } = useAppStore();

  const { isGenerating, sendMessage, retryMessage } = useStreamChat();

  const [input, setInput] = useState("");
  const [chatModels, setChatModels] = useState<any[]>([]);
  const [selectedModel, setSelectedModel] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [enableTools, setEnableTools] = useState(true);
  const [activeToolCalls, setActiveToolCalls] = useState<any[]>([]);

  const activeMessages = activeSessionId ? messages[activeSessionId] || [] : [];
  const activeSession = sessions.find((s) => s.id === activeSessionId);

  // 从数据库获取聊天模型列表
  useEffect(() => {
    const fetchChatModels = async () => {
      if (window.electronAPI?.dbGetModels) {
        const list = await window.electronAPI.dbGetModels();
        setChatModels(list.filter((m: any) => m.type === "chat"));
      }
    };
    fetchChatModels();
  }, []);

  // 同步选中的模型
  useEffect(() => {
    if (activeSessionId && chatModels.length > 0) {
      const sessionModel = activeSession?.model;
      const matchedModel = chatModels.find(
        (m) => m.id === sessionModel || m.model_id === sessionModel,
      );
      setSelectedModel(matchedModel?.id || chatModels[0].id);
    }
  }, [activeSessionId, chatModels]);

  // 初始化
  useEffect(() => {
    initStore();
  }, []);

  // 切换到工作台、图像、视频或设置页时，自动关闭聊天右侧边栏，避免遮挡主内容。
  useEffect(() => {
    if (activeView !== "chat") {
      setSidebarOpen(false);
    }
  }, [activeView]);

  const handleSend = () => {
    if (!input.trim() || !activeSessionId || isGenerating) return;
    const text = input;
    setInput("");
    setActiveToolCalls([]);
    sendMessage(
      text,
      selectedModel || chatModels[0]?.id || "model_chat_default",
      enableTools,
      {
        onToolStatus: (status) => {
          setActiveToolCalls((prev) => {
            if (status.status === "running") {
              return [...prev, status];
            }
            return prev.map((t) =>
              t.tool === status.tool && t.callId === status.callId ? status : t,
            );
          });
        },
      },
    );
  };

  const handleRetry = (msg: any) => {
    if (isGenerating || !activeSessionId) return;
    setActiveToolCalls([]);
    retryMessage(
      msg.id,
      selectedModel || chatModels[0]?.id || "model_chat_default",
      enableTools,
      {
        onToolStatus: (status) => {
          setActiveToolCalls((prev) => {
            if (status.status === "running") {
              return [...prev, status];
            }
            return prev.map((t) =>
              t.tool === status.tool && t.callId === status.callId ? status : t,
            );
          });
        },
      },
    );
  };

  const handleRenameSession = (id: string, title: string) => {
    updateSessionTitle(id, title);
  };

  const handleSelectWorkDir = async () => {
    if (!activeSessionId) return;
    const api = window.electronAPI as any;
    if (!api.dialogSelectWorkDirectory) return;
    try {
      const dir = await api.dialogSelectWorkDirectory();
      if (!dir) return;
      await setSessionWorkDir(activeSessionId, dir);
    } catch (err) {
      console.error("选择工作目录失败:", err);
    }
  };

  const handleCopy = (text: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
    }
  };

  return (
    <>
      {/* Column 2: 会话列表 */}
      <SessionList
        sessions={sessions}
        activeSessionId={activeSessionId}
        onAddSession={addSession}
        onSelectSession={setActiveSession}
        onDeleteSession={deleteSession}
        onRenameSession={handleRenameSession}
      />

      {/* Column 3: 聊天窗口 */}
      <div className="flex-1 h-full flex bg-[#1a1a1a] overflow-hidden">
        <div className="flex-1 h-full flex flex-col overflow-hidden">
        <ChatHeader
          session={activeSession}
          extra={
            <div className="flex items-center gap-2">
              {/* 右侧边栏开关 */}
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className={`p-1.5 rounded-md transition-colors ${
                  sidebarOpen
                    ? "bg-indigo-600/20 text-indigo-400"
                    : "text-gray-500 hover:text-gray-200 hover:bg-gray-700"
                }`}
                title={sidebarOpen ? "关闭侧边栏" : "打开侧边栏"}
              >
                <PanelRight size={16} />
              </button>
            </div>
          }
        />

        {/* 空态 */}
        {!activeSessionId ? (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            请在左侧选择或创建一个会话
          </div>
        ) : (
          <>
            <MessageList
              messages={activeMessages}
              isGenerating={isGenerating}
              activeSearchProgress={null}
              activeToolCalls={activeToolCalls}
              onCopy={handleCopy}
              onRetry={handleRetry}
            />
            <MessageInput
              value={input}
              onChange={setInput}
              onSend={handleSend}
              isGenerating={isGenerating}
              disabled={!activeSessionId}
              containerWidth={0}
              enableTools={enableTools}
              onModeChange={setEnableTools}
              workDir={activeSession?.workDir || null}
              onSelectWorkDir={handleSelectWorkDir}
              selectedModel={selectedModel}
              chatModels={chatModels}
              onChangeModel={(val) => {
                setSelectedModel(val);
                if (activeSessionId) {
                  updateSessionModel(activeSessionId, val);
                }
              }}
            />
          </>
        )}
      </div>

      {/* 右侧边栏 */}
      <RightSidebar
        open={sidebarOpen}
        title="会话信息"
        onClose={() => setSidebarOpen(false)}
      >
        <ChatSidebar
          session={activeSession}
          messages={activeMessages}
        />
      </RightSidebar>
      </div>
    </>
  );
};

export default ChatView;