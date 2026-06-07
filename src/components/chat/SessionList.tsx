import React, { useEffect, useRef, useState } from "react";
import { Edit2, MessageSquare, Plus, Trash2 } from "lucide-react";
import { Session } from "../../stores/chatStore";

interface Props {
  sessions: Session[];
  activeSessionId: string | null;
  onAddSession: () => void;
  onSelectSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
  onRenameSession: (id: string, title: string) => void;
}

const SessionList: React.FC<Props> = ({
  sessions,
  activeSessionId,
  onAddSession,
  onSelectSession,
  onDeleteSession,
  onRenameSession,
}) => {
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (editingSessionId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingSessionId]);

  const startRename = (session: Session) => {
    setEditingSessionId(session.id);
    setEditingTitle(session.title);
  };

  const finishRename = (sessionId: string) => {
    const nextTitle = editingTitle.trim();
    if (!nextTitle) {
      setEditingSessionId(null);
      setEditingTitle("");
      return;
    }

    onRenameSession(sessionId, nextTitle);
    setEditingSessionId(null);
    setEditingTitle("");
  };

  return (
    <div className="w-80 h-full bg-[#202020] border-r border-gray-700/50 flex flex-col flex-shrink-0">
      <div className="px-4 font-bold text-lg border-b border-gray-700/50 titlebar-drag h-[60px] flex items-center justify-between">
        <span>聊天</span>
        <button
          onClick={onAddSession}
          className="titlebar-no-drag p-1.5 hover:bg-gray-700/60 rounded-md text-gray-300 transition-colors"
        >
          <Plus size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {sessions.map((session) => {
          const isEditing = editingSessionId === session.id;
          const isActive = activeSessionId === session.id;

          return (
            <div
              key={session.id}
              onClick={() => !isEditing && onSelectSession(session.id)}
              className={`group flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${
                isActive
                  ? "bg-indigo-600 text-white"
                  : "hover:bg-gray-800 text-gray-300"
              }`}
            >
              <MessageSquare size={18} className="flex-shrink-0 opacity-70" />

              {isEditing ? (
                <input
                  ref={inputRef}
                  value={editingTitle}
                  onChange={(e) => setEditingTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      finishRename(session.id);
                    }
                    if (e.key === "Escape") {
                      e.preventDefault();
                      setEditingSessionId(null);
                      setEditingTitle("");
                    }
                  }}
                  onBlur={() => finishRename(session.id)}
                  onClick={(e) => e.stopPropagation()}
                  className="h-8 flex-1 px-2 text-sm font-medium rounded-md bg-white text-gray-900 outline-none ring-2 ring-indigo-400"
                />
              ) : (
                <span className="truncate min-w-0 flex-1 text-sm font-medium">
                  {session.title}
                </span>
              )}

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  startRename(session);
                }}
                className={`p-1 rounded-md hover:bg-indigo-500/30 transition-colors opacity-0 group-hover:opacity-100 ${
                  isActive ? "text-indigo-100" : "text-gray-500 hover:text-gray-100"
                }`}
                title="重命名对话"
              >
                <Edit2 size={14} />
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteSession(session.id);
                }}
                className={`p-1 rounded-md hover:bg-red-500 hover:text-white transition-colors opacity-0 group-hover:opacity-100 ${
                  isActive ? "text-indigo-100" : "text-gray-500"
                }`}
                title="删除对话"
              >
                <Trash2 size={16} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SessionList;
