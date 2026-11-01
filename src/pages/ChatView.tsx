import React, { useState, useEffect } from 'react';
import { PanelRight } from 'lucide-react';
import { useChatStore } from '../stores/chatStore';
import { useStreamChat } from '../hooks/useStreamChat';
import { useAppStore } from '../stores/appStore';
import SessionList from '@/pages/chat/SessionList';
import ChatHeader from '@/pages/chat/ChatHeader';
import MessageList from '@/pages/chat/MessageList';
import MessageInput from '@/pages/chat/MessageInput';
import AgentInspectorSidebar from '@/components/agent/AgentInspectorSidebar';

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
    refreshOutputs,
    refreshGitStatus,
    refreshMcpAndSkills,
  } = useChatStore();

  const { activeView } = useAppStore();
  const { isGenerating, sendMessage, retryMessage } = useStreamChat();

  const [input, setInput] = useState('');
  const [chatModels, setChatModels] = useState<any[]>([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true); // 默认开启 Inspector 监控面板
  const [enableTools, setEnableTools] = useState(true);
  const [activeToolCalls, setActiveToolCalls] = useState<any[]>([]);

  const activeMessages = activeSessionId ? messages[activeSessionId] || [] : [];
  const activeSession = sessions.find((s) => s.id === activeSessionId);

  // 获取模型列表
  useEffect(() => {
    const fetchChatModels = async () => {
      if (window.electronAPI?.dbGetModels) {
        const list = await window.electronAPI.dbGetModels();
        setChatModels(list.filter((m: any) => m.type === 'chat'));
      }
    };
    fetchChatModels();
  }, []);

  // 同步选中的模型
  useEffect(() => {
    if (activeSessionId && chatModels.length > 0) {
      const sessionModel = activeSession?.model;
      const matchedModel = chatModels.find(
        (m) => m.id === sessionModel || m.model_id === sessionModel
      );
      setSelectedModel(matchedModel?.id || chatModels[0].id);
    }
  }, [activeSessionId, chatModels]);

  // 初始化 Store
  useEffect(() => {
    initStore();
  }, []);

  // 当会话改变或工作区更新时刷新 Inspector 数据
  useEffect(() => {
    if (activeSessionId) {
      refreshOutputs(activeSessionId);
      refreshGitStatus(activeSession?.workDir);
      refreshMcpAndSkills(activeSession?.workDir);
    }
  }, [activeSessionId, activeSession?.workDir]);

  // 离开 chat 视图时折叠侧边栏
  useEffect(() => {
    if (activeView !== 'chat') {
      setSidebarOpen(false);
    }
  }, [activeView]);

  const handleSend = () => {
    if (!input.trim() || !activeSessionId || isGenerating) return;
    const text = input;
    setInput('');
    setActiveToolCalls([]);
    sendMessage(
      text,
      selectedModel || chatModels[0]?.id || 'model_chat_default',
      enableTools,
      {
        onToolStatus: (status) => {
          setActiveToolCalls((prev) => {
            if (status.status === 'running') {
              return [...prev, status];
            }
            return prev.map((t) =>
              t.tool === status.tool && t.callId === status.callId ? status : t
            );
          });
        },
      }
    );
  };

  const handleRetry = (msg: any) => {
    if (isGenerating || !activeSessionId) return;
    setActiveToolCalls([]);
    retryMessage(
      msg.id,
      selectedModel || chatModels[0]?.id || 'model_chat_default',
      enableTools,
      {
        onToolStatus: (status) => {
          setActiveToolCalls((prev) => {
            if (status.status === 'running') {
              return [...prev, status];
            }
            return prev.map((t) =>
              t.tool === status.tool && t.callId === status.callId ? status : t
            );
          });
        },
      }
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
      console.error('选择工作目录失败:', err);
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

      {/* Column 3: 聊天窗口与右侧 Inspector */}
      <div className='flex-1 h-full flex bg-[#161616] overflow-hidden'>
        <div className='flex-1 h-full flex flex-col overflow-hidden'>
          <ChatHeader
            session={activeSession}
            extra={
              <div className='flex items-center gap-2'>
                {/* 右侧边栏开关 */}
                <button
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className={`p-1.5 rounded-lg transition-all ${
                    sidebarOpen
                      ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                      : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
                  }`}
                  title={sidebarOpen ? '收起 Inspector 监控面板' : '展开 Inspector 监控面板'}
                >
                  <PanelRight size={17} />
                </button>
              </div>
            }
          />

          {/* 空态 */}
          {!activeSessionId ? (
            <div className='flex-1 flex items-center justify-center text-neutral-400'>
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

        {/* 右侧 Agent Inspector 抽屉 (对应参考图 2) */}
        <AgentInspectorSidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
      </div>
    </>
  );
};

export default ChatView;
