import React from "react";
import { Session } from "../../stores/chatStore";
import WorkspacePopover from "@/components/agent/WorkspacePopover";

interface Props {
  session: Session | undefined;
  extra?: React.ReactNode;
}

const ChatHeader: React.FC<Props> = ({ session, extra }) => {
  if (!session) return null;

  return (
    <div className="h-[48px] border-b border-[#242424] bg-[#141414] flex-shrink-0 flex items-center justify-between px-5 titlebar-drag select-none z-30">
      {/* 会话标题与当前工作区路径简略提示 */}
      <div className="flex items-center gap-2.5 min-w-0">
        <h1 className="font-semibold text-neutral-200 text-xs truncate max-w-[280px]">
          {session.title}
        </h1>
        {session.workDir && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#202020] text-neutral-400 font-mono border border-[#2e2e2e] truncate max-w-[200px]">
            {session.workDir.split('/').pop()}
          </span>
        )}
      </div>

      {/* 顶部右侧：工作区 Popover (图 1) + 额外控件 (如 Inspector 侧边栏展开) */}
      <div className="flex items-center gap-3 titlebar-no-drag">
        <WorkspacePopover />
        {extra && (
          <div className="flex items-center pl-1 border-l border-[#2e2e2e]">
            {extra}
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatHeader;
