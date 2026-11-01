import { create } from "zustand";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
  metadata?: any;
}

export interface Session {
  id: string;
  title: string;
  updatedAt: number;
  model?: string;
  workDir?: string;
}

export interface ContextBreakdownItem {
  tokens: number;
  formatted: string;
  percent: number;
  color: string;
  label: string;
}

export interface ContextMetrics {
  totalLimit: number;
  totalLimitFormatted: string;
  usedTokens: number;
  usedTokensFormatted: string;
  usedPercent: number;
  breakdown: {
    messages: ContextBreakdownItem;
    systemTools: ContextBreakdownItem;
    systemPrompt: ContextBreakdownItem;
    skills: ContextBreakdownItem;
    freeSpace: ContextBreakdownItem;
  };
}

export interface SessionOutput {
  id: string;
  name: string;
  filePath: string;
  fileType: string;
  createdAt: number;
}

export interface WorkspaceGitStatus {
  isGit: boolean;
  branch?: string;
  insertions: number;
  deletions: number;
  modifiedFiles: Array<{ path: string; status: string }>;
}

export interface McpServerItem {
  id: string;
  name: string;
  command: string;
  args: string[];
  description: string;
  enabled: boolean;
}

export interface SkillItem {
  id: string;
  name: string;
  description: string;
  tools: string[];
  scope: string;
}

interface ChatState {
  sessions: Session[];
  activeSessionId: string | null;
  messages: Record<string, Message[]>;
  contextMetrics: ContextMetrics | null;
  outputs: SessionOutput[];
  gitStatus: WorkspaceGitStatus | null;
  mcpServers: McpServerItem[];
  skills: SkillItem[];

  initStore: () => Promise<void>;
  addSession: () => Promise<void>;
  setActiveSession: (id: string) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  updateSessionTitle: (id: string, title: string) => Promise<void>;
  setSessionWorkDir: (id: string, workDir: string | null) => Promise<void>;
  addMessage: (sessionId: string, message: Message, skipDb?: boolean) => Promise<void>;
  appendMessageDelta: (
    sessionId: string,
    messageId: string,
    delta: string,
  ) => void;
  saveMessageToDb: (sessionId: string, message: Message) => Promise<void>;
  updateSessionModel: (sessionId: string, model: string) => Promise<void>;
  updateMessageMetadata: (sessionId: string, messageId: string, metadata: any) => void;
  truncateMessages: (sessionId: string, messageId: string) => Promise<void>;

  setContextMetrics: (metrics: ContextMetrics | null) => void;
  refreshOutputs: (sessionId: string) => Promise<void>;
  refreshGitStatus: (workDir?: string | null) => Promise<void>;
  refreshMcpAndSkills: (workDir?: string | null) => Promise<void>;
}

export const useChatStore = create<ChatState>((set, get) => ({
  sessions: [],
  activeSessionId: null,
  messages: {},
  contextMetrics: null,
  outputs: [],
  gitStatus: null,
  mcpServers: [],
  skills: [],

  initStore: async () => {
    if (!window.electronAPI) return;
    try {
      const dbSessions = await window.electronAPI.dbGetSessions();

      let activeId = null;
      const initialMessages: Record<string, Message[]> = {};

      if (dbSessions.length > 0) {
        activeId = dbSessions[0].id;
        const dbMsgs = await window.electronAPI.dbGetMessages(activeId);
        initialMessages[activeId] = dbMsgs.map((m: any) => {
          let parsedMeta = null;
          if (m.metadata) {
            try {
              parsedMeta = typeof m.metadata === "string" ? JSON.parse(m.metadata) : m.metadata;
            } catch (e) {
              console.error("Failed to parse metadata in initStore:", e);
            }
          }
          return {
            id: m.id,
            role: m.role,
            content: m.content,
            createdAt: m.created_at || m.createdAt,
            metadata: parsedMeta,
          };
        });
      } else {
        const newId = crypto.randomUUID();
        const defaultSession = { id: newId, title: "新的 Agent 会话", updatedAt: Date.now(), model: "" };
        await window.electronAPI.dbAddSession(defaultSession);

        const welcomeMsg = {
          id: "m1",
          role: "assistant" as const,
          content: "你好！我是你的智能开发助手。你可以指定工作区目录，让我帮你分析代码、重构工程、排查错误或执行任务。",
          createdAt: Date.now(),
          metadata: null,
        };
        await window.electronAPI.dbAddMessage({
          id: welcomeMsg.id,
          sessionId: newId,
          role: welcomeMsg.role,
          content: welcomeMsg.content,
          metadata: null,
        });

        dbSessions.push(defaultSession);
        activeId = newId;
        initialMessages[newId] = [welcomeMsg];
      }

      set({
        sessions: dbSessions.map((s: any) => ({
          id: s.id,
          title: s.title,
          updatedAt: s.updated_at || s.updatedAt,
          model: s.model || "",
          workDir: s.work_dir || s.workDir || undefined,
        })),
        activeSessionId: activeId,
        messages: initialMessages,
      });

      if (activeId) {
        const activeSession = dbSessions.find((s: any) => s.id === activeId);
        get().refreshOutputs(activeId);
        get().refreshGitStatus(activeSession?.work_dir || activeSession?.workDir);
        get().refreshMcpAndSkills(activeSession?.work_dir || activeSession?.workDir);
      }
    } catch (err) {
      console.error("初始化 ChatStore 失败:", err);
    }
  },

  addSession: async () => {
    if (!window.electronAPI) return;
    const newId = crypto.randomUUID();
    const newSession = { id: newId, title: "新的 Agent 会话", updatedAt: Date.now(), model: "" };

    try {
      await window.electronAPI.dbAddSession(newSession);

      set((state) => ({
        sessions: [newSession, ...state.sessions],
        activeSessionId: newId,
        messages: { ...state.messages, [newId]: [] },
        outputs: [],
        contextMetrics: null,
      }));

      get().refreshMcpAndSkills(null);
    } catch (err) {
      console.error("创建会话失败:", err);
    }
  },

  setActiveSession: async (id) => {
    if (!window.electronAPI) return;

    const state = get();
    const targetSession = state.sessions.find((s) => s.id === id);
    const workDir = targetSession?.workDir;

    if (!state.messages[id]) {
      try {
        const dbMsgs = await window.electronAPI.dbGetMessages(id);
        const mappedMsgs = dbMsgs.map((m: any) => {
          let parsedMeta = null;
          if (m.metadata) {
            try {
              parsedMeta = typeof m.metadata === "string" ? JSON.parse(m.metadata) : m.metadata;
            } catch (e) {
              console.error("Failed to parse metadata in setActiveSession:", e);
            }
          }
          return {
            id: m.id,
            role: m.role,
            content: m.content,
            createdAt: m.created_at || m.createdAt,
            metadata: parsedMeta,
          };
        });
        set((state) => ({
          activeSessionId: id,
          messages: { ...state.messages, [id]: mappedMsgs }
        }));
      } catch (err) {
        console.error("获取消息历史失败:", err);
      }
    } else {
      set({ activeSessionId: id });
    }

    get().refreshOutputs(id);
    get().refreshGitStatus(workDir);
    get().refreshMcpAndSkills(workDir);
  },

  deleteSession: async (id) => {
    if (!window.electronAPI) return;
    try {
      await window.electronAPI.dbDeleteSession(id);
      set((state) => {
        const newSessions = state.sessions.filter((s) => s.id !== id);
        const newActive =
          state.activeSessionId === id
            ? newSessions[0]?.id || null
            : state.activeSessionId;

        const newMessages = { ...state.messages };
        delete newMessages[id];

        return {
          sessions: newSessions,
          activeSessionId: newActive,
          messages: newMessages,
        };
      });

      const nextActiveId = get().activeSessionId;
      if (nextActiveId) {
        get().setActiveSession(nextActiveId);
      }
    } catch (err) {
      console.error("删除会话失败:", err);
    }
  },

  updateSessionTitle: async (id, title) => {
    if (!window.electronAPI) return;
    try {
      await window.electronAPI.dbUpdateSessionTitle(id, title);
      set((state) => ({
        sessions: state.sessions.map((s) =>
          s.id === id ? { ...s, title, updatedAt: Date.now() } : s
        ),
      }));
    } catch (err) {
      console.error("更新会话标题失败:", err);
    }
  },

  setSessionWorkDir: async (id, workDir) => {
    if (!window.electronAPI) return;
    try {
      await window.electronAPI.dbUpdateSessionWorkDir(id, workDir || "");
      set((state) => ({
        sessions: state.sessions.map((s) =>
          s.id === id ? { ...s, workDir: workDir || undefined, updatedAt: Date.now() } : s
        ),
      }));
      get().refreshGitStatus(workDir);
      get().refreshMcpAndSkills(workDir);
    } catch (err) {
      console.error("更新会话工作目录失败:", err);
    }
  },

  addMessage: async (sessionId, message, skipDb = false) => {
    set((state) => {
      const currentMsgs = state.messages[sessionId] || [];
      return {
        messages: {
          ...state.messages,
          [sessionId]: [...currentMsgs, message],
        },
      };
    });

    if (!skipDb && window.electronAPI) {
      try {
        await window.electronAPI.dbAddMessage({
          id: message.id,
          sessionId,
          role: message.role,
          content: message.content,
          metadata: message.metadata,
        });
      } catch (err) {
        console.error("持久化消息失败:", err);
      }
    }
  },

  appendMessageDelta: (sessionId, messageId, delta) => {
    set((state) => {
      const currentMsgs = state.messages[sessionId] || [];
      const msgIndex = currentMsgs.findIndex((m) => m.id === messageId);
      if (msgIndex === -1) return state;

      const updatedMsgs = [...currentMsgs];
      const targetMsg = updatedMsgs[msgIndex];
      updatedMsgs[msgIndex] = {
        ...targetMsg,
        content: targetMsg.content + delta,
      };

      return {
        messages: {
          ...state.messages,
          [sessionId]: updatedMsgs,
        },
      };
    });
  },

  saveMessageToDb: async (sessionId, message) => {
    if (!window.electronAPI) return;
    try {
      await window.electronAPI.dbAddMessage({
        id: message.id,
        sessionId,
        role: message.role,
        content: message.content,
        metadata: message.metadata,
      });
    } catch (err) {
      console.error("保存消息到存储失败:", err);
    }
  },

  updateSessionModel: async (sessionId, model) => {
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === sessionId ? { ...s, model } : s
      ),
    }));
    if (window.electronAPI) {
      try {
        await window.electronAPI.dbAddSession({
          id: sessionId,
          title: get().sessions.find((s) => s.id === sessionId)?.title || "对话",
          model,
        });
      } catch (err) {
        console.error("更新模型持久化失败:", err);
      }
    }
  },

  updateMessageMetadata: (sessionId, messageId, metadata) => {
    set((state) => {
      const currentMsgs = state.messages[sessionId] || [];
      const msgIndex = currentMsgs.findIndex((m) => m.id === messageId);
      if (msgIndex === -1) return state;

      const updatedMsgs = [...currentMsgs];
      updatedMsgs[msgIndex] = {
        ...updatedMsgs[msgIndex],
        metadata,
      };

      return {
        messages: {
          ...state.messages,
          [sessionId]: updatedMsgs,
        },
      };
    });
  },

  truncateMessages: async (sessionId, messageId) => {
    const currentMsgs = get().messages[sessionId] || [];
    const targetMsg = currentMsgs.find((m) => m.id === messageId);
    if (!targetMsg) return;

    const filtered = currentMsgs.filter((m) => m.createdAt <= targetMsg.createdAt);

    set((state) => ({
      messages: {
        ...state.messages,
        [sessionId]: filtered,
      },
    }));

    if (window.electronAPI) {
      try {
        await window.electronAPI.dbDeleteMessagesAfter(sessionId, targetMsg.createdAt);
      } catch (err) {
        console.error("截断消息失败:", err);
      }
    }
  },

  setContextMetrics: (metrics) => set({ contextMetrics: metrics }),

  refreshOutputs: async (sessionId) => {
    if (!window.electronAPI?.getSessionOutputs || !sessionId) return;
    try {
      const outs = await window.electronAPI.getSessionOutputs(sessionId);
      set({ outputs: outs || [] });
    } catch (err) {
      console.error("刷新 Outputs 失败:", err);
    }
  },

  refreshGitStatus: async (workDir) => {
    if (!window.electronAPI?.getWorkspaceGitStatus) return;
    try {
      const status = await window.electronAPI.getWorkspaceGitStatus(workDir || null);
      set({ gitStatus: status || null });
    } catch (err) {
      console.error("刷新 Git 状态失败:", err);
    }
  },

  refreshMcpAndSkills: async (workDir) => {
    if (!window.electronAPI) return;
    try {
      const [mcps, skills] = await Promise.all([
        window.electronAPI.getMcpServers ? window.electronAPI.getMcpServers(workDir) : [],
        window.electronAPI.getSkills ? window.electronAPI.getSkills(workDir) : [],
      ]);
      set({ mcpServers: mcps || [], skills: skills || [] });
    } catch (err) {
      console.error("刷新 MCP 和 Skills 失败:", err);
    }
  },
}));
