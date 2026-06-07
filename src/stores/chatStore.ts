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

interface ElectronAPI {
  dbGetSessions: () => Promise<any[]>;
  dbAddSession: (session: { id: string; title: string; model?: string }) => Promise<boolean>;
  dbUpdateSessionTitle: (id: string, title: string) => Promise<boolean>;
  dbDeleteSession: (id: string) => Promise<boolean>;
  dbGetMessages: (sessionId: string) => Promise<any[]>;
  dbAddMessage: (msg: { id: string; sessionId: string; role: string; content: string; metadata?: any }) => Promise<boolean>;
  dbDeleteMessagesAfter: (sessionId: string, timestamp: number) => Promise<boolean>;
  dbGetSessionWorkDir: (id: string) => Promise<string | null>;
  dbUpdateSessionWorkDir: (id: string, workDir: string) => Promise<boolean>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI & any;
  }
}

interface ChatState {
  sessions: Session[];
  activeSessionId: string | null;
  messages: Record<string, Message[]>;
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
}

export const useChatStore = create<ChatState>((set, get) => ({
  sessions: [],
  activeSessionId: null,
  messages: {},

  initStore: async () => {
    if (!window.electronAPI) return;
    try {
      const dbSessions = await window.electronAPI.dbGetSessions();
      
      let activeId = null;
      const initialMessages: Record<string, Message[]> = {};

      if (dbSessions.length > 0) {
        activeId = dbSessions[0].id;
        // 加载当前活跃会话的消息
        const dbMsgs = await window.electronAPI.dbGetMessages(activeId);
        initialMessages[activeId] = dbMsgs.map((m: any) => {
          let parsedMeta = null;
          if (m.metadata) {
            try {
              parsedMeta = JSON.parse(m.metadata);
            } catch (e) {
              console.error("Failed to parse metadata in initStore:", e);
            }
          }
          return {
            id: m.id,
            role: m.role,
            content: m.content,
            createdAt: m.created_at,
            metadata: parsedMeta,
          };
        });
      } else {
        // 如果没有会话，初始化创建一个默认会话
        const newId = crypto.randomUUID();
        const defaultSession = { id: newId, title: "新的对话", updatedAt: Date.now(), model: "" };
        await window.electronAPI.dbAddSession(defaultSession);
        
        const welcomeMsg = {
          id: "m1",
          role: "assistant" as const,
          content: "你好！我是 Agnes AI，有什么可以帮你的？",
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

        dbSessions.push({ ...defaultSession, search_enabled: 0 });
        activeId = newId;
        initialMessages[newId] = [welcomeMsg];
      }

      set({
        sessions: dbSessions.map((s: any) => ({
          id: s.id,
          title: s.title,
          updatedAt: s.updated_at,
          model: s.model || "",
          workDir: s.work_dir || undefined,
        })),
        activeSessionId: activeId,
        messages: initialMessages,
      });
    } catch (err) {
      console.error("初始化 ChatStore 失败:", err);
    }
  },

  addSession: async () => {
    if (!window.electronAPI) return;
    const newId = crypto.randomUUID();
    const newSession = { id: newId, title: "新的对话", updatedAt: Date.now(), model: "" };

    try {
      await window.electronAPI.dbAddSession(newSession);
      
      set((state) => ({
        sessions: [newSession, ...state.sessions],
        activeSessionId: newId,
        messages: { ...state.messages, [newId]: [] },
      }));
    } catch (err) {
      console.error("创建会话失败:", err);
    }
  },

  setActiveSession: async (id) => {
    if (!window.electronAPI) return;
    
    // 如果没有加载过该会话的消息，则从数据库加载
    const state = get();
    if (!state.messages[id]) {
      try {
        const dbMsgs = await window.electronAPI.dbGetMessages(id);
        const mappedMsgs = dbMsgs.map((m: any) => {
          let parsedMeta = null;
          if (m.metadata) {
            try {
              parsedMeta = JSON.parse(m.metadata);
            } catch (e) {
              console.error("Failed to parse metadata in setActiveSession:", e);
            }
          }
          return {
            id: m.id,
            role: m.role,
            content: m.content,
            createdAt: m.created_at,
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

        return { sessions: newSessions, activeSessionId: newActive, messages: newMessages };
      });
    } catch (err) {
      console.error("删除会话失败:", err);
    }
  },

  updateSessionTitle: async (id, title) => {
    if (!window.electronAPI) return;

    const nextTitle = title.trim();
    if (!nextTitle) return;

    try {
      const updated = await window.electronAPI.dbUpdateSessionTitle(id, nextTitle);
      if (!updated) return;

      set((state) => ({
        sessions: state.sessions.map((s) =>
          s.id === id ? { ...s, title: nextTitle } : s,
        ),
      }));
    } catch (err) {
      console.error("更新会话标题失败:", err);
    }
  },

  setSessionWorkDir: async (id, workDir) => {
    if (!window.electronAPI) return;

    try {
      const updated = await window.electronAPI.dbUpdateSessionWorkDir(id, workDir || "");
      if (!updated) return;

      set((state) => ({
        sessions: state.sessions.map((s) =>
          s.id === id ? { ...s, workDir: workDir || undefined } : s,
        ),
      }));
    } catch (err) {
      console.error("更新会话工作目录失败:", err);
    }
  },

  addMessage: async (sessionId, message, skipDb = false) => {
    set((state) => {
      const sessionMessages = state.messages[sessionId] || [];
      return {
        messages: {
          ...state.messages,
          [sessionId]: [...sessionMessages, message],
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
        
        // 更新会话列表中的时间
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === sessionId ? { ...s, updatedAt: Date.now() } : s
          ).sort((a, b) => b.updatedAt - a.updatedAt),
        }));
      } catch (err) {
        console.error("写入消息到 SQLite 失败:", err);
      }
    }
  },

  appendMessageDelta: (sessionId, messageId, delta) =>
    set((state) => {
      const sessionMsgs = state.messages[sessionId] || [];
      const newMsgs = sessionMsgs.map((m) =>
        m.id === messageId ? { ...m, content: m.content + delta } : m
      );
      return { messages: { ...state.messages, [sessionId]: newMsgs } };
    }),

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
      console.error("异步保存助手消息到 SQLite 失败:", err);
    }
  },

  updateSessionModel: async (sessionId, model) => {
    if (!window.electronAPI) return;
    try {
      const session = get().sessions.find((s) => s.id === sessionId);
      if (session) {
        const updated = { ...session, model };
        await window.electronAPI.dbAddSession({
          id: session.id,
          title: session.title,
          model: model,
        });
        set((state) => ({
          sessions: state.sessions.map((s) => (s.id === sessionId ? updated : s)),
        }));
      }
    } catch (err) {
      console.error("更新会话模型失败:", err);
    }
  },

  updateMessageMetadata: (sessionId, messageId, metadata) =>
    set((state) => {
      const sessionMsgs = state.messages[sessionId] || [];
      const newMsgs = sessionMsgs.map((m) =>
        m.id === messageId ? { ...m, metadata: metadata && metadata.length > 0 ? metadata : null } : m
      );
      return { messages: { ...state.messages, [sessionId]: newMsgs } };
    }),

  truncateMessages: async (sessionId, messageId) => {
    const state = get();
    const sessionMessages = state.messages[sessionId] || [];
    const index = sessionMessages.findIndex((m) => m.id === messageId);
    if (index === -1) return;

    const targetMsg = sessionMessages[index];
    const keptMsgs = sessionMessages.slice(0, index + 1);

    if (window.electronAPI && window.electronAPI.dbDeleteMessagesAfter) {
      try {
        await window.electronAPI.dbDeleteMessagesAfter(sessionId, targetMsg.createdAt);
      } catch (err) {
        console.error("Failed to delete messages after timestamp:", err);
      }
    }

    set((state) => ({
      messages: {
        ...state.messages,
        [sessionId]: keptMsgs,
      },
    }));
  },
}));