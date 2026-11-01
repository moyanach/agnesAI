import React, { useRef, useEffect } from "react";
import { Send, FolderOpen } from "lucide-react";

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  isGenerating: boolean;
  disabled?: boolean;
  containerWidth: number;

  // Agent 模式切换
  enableTools?: boolean;
  onModeChange?: (enable: boolean) => void;

  // 工作目录
  workDir?: string | null;
  onSelectWorkDir?: () => void;

  // 底部栏控件
  selectedModel?: string;
  chatModels?: any[];
  onChangeModel?: (modelId: string) => void;
}

const MessageInput: React.FC<Props> = ({
  value,
  onChange,
  onSend,
  isGenerating,
  disabled,
  containerWidth,
  enableTools = true,
  onModeChange,
  workDir,
  onSelectWorkDir,
  selectedModel,
  chatModels,
  onChangeModel,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      // Shift+Enter → 换行；Ctrl/Meta+Enter → 也视为发送（备用）
      if (e.shiftKey) return;
      e.preventDefault();
      onSend();
    }
  };

  // 重置高度当 value 清空时
  useEffect(() => {
    if (!value && textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [value]);

  return (
    <div className="p-3 pt-2 bg-[#1a1a1a] border-t border-gray-700/50 flex-shrink-0">
      <div
        className="mx-auto bg-[#2a2a2a] border border-gray-600/50 rounded-xl focus-within:border-indigo-500/70 focus-within:ring-1 focus-within:ring-indigo-500/50 transition-all"
        style={{
          maxWidth: containerWidth
            ? `${Math.min(containerWidth * 0.9, 1200)}px`
            : "90%",
        }}
      >
        {/* 文本输入区（独立占行） */}
        <div className="p-2 pb-0">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="输入消息，按 Enter 发送，Shift + Enter 换行..."
            className="w-full max-h-40 min-h-[40px] bg-transparent text-gray-200 resize-none outline-none px-2 py-2 text-sm scroll-smooth"
            rows={1}
          />
        </div>

        {/* 底部栏：模式切换 + 模型选择左对齐，发送按钮右对齐 */}
        <div className="flex items-center gap-2 px-3 pb-2">
          {/* Ask / Agent 模式切换 */}
          {onModeChange && (
            <div className="flex items-center bg-[#1e1e1e] border border-gray-700 rounded-lg overflow-hidden flex-shrink-0">
              <button
                onClick={() => onModeChange(false)}
                className={`px-2.5 py-1 text-xs font-medium transition-colors ${
                  !enableTools
                    ? "bg-indigo-600/20 text-indigo-400"
                    : "text-gray-500 hover:text-gray-300"
                }`}
                title="Ask 模式：纯对话，不调用工具"
              >
                Ask
              </button>
              <button
                onClick={() => onModeChange(true)}
                className={`px-2.5 py-1 text-xs font-medium transition-colors ${
                  enableTools
                    ? "bg-indigo-600/20 text-indigo-400"
                    : "text-gray-500 hover:text-gray-300"
                }`}
                title="Agent 模式：LLM 可自动调用工具（搜索/读写文件等）"
              >
                Agent
              </button>
            </div>
          )}

          {/* 工作目录选择 */}
          {onSelectWorkDir && (
            <button
              onClick={onSelectWorkDir}
              className="flex items-center gap-1 px-2 py-1 text-xs text-gray-400 hover:text-gray-200 bg-[#242424] border border-gray-700 rounded-md transition-colors"
              title={workDir ? `当前工作目录: ${workDir}\n点击更改目录` : "未选择目录，默认使用项目根目录\n点击选择工作目录"}
            >
              <FolderOpen size={14} />
              <span className="max-w-[100px] truncate">
                {workDir
                  ? workDir.split(/[\\/]/).filter(Boolean).pop() || workDir
                  : "项目根目录"}
              </span>
            </button>
          )}

          {chatModels && chatModels.length > 0 && onChangeModel && (
            <select
              value={selectedModel}
              onChange={(e) => onChangeModel(e.target.value)}
              className="bg-[#242424] border border-gray-700 rounded-md px-2 py-1 text-xs text-gray-400 outline-none focus:border-indigo-500 transition-colors cursor-pointer"
            >
              {chatModels.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name || m.model_id}
                </option>
              ))}
            </select>
          )}

          <div className="ml-auto">
            <button
              onClick={onSend}
              disabled={!value.trim() || isGenerating || disabled}
              className="p-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:hover:bg-indigo-600 text-white rounded-lg transition-colors flex items-center justify-center"
            >
              {isGenerating ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <Send size={16} />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MessageInput;