import React from "react";
import { Session } from "../../stores/chatStore";

interface Props {
  session: Session | undefined;
  extra?: React.ReactNode;
}

const ChatHeader: React.FC<Props> = ({ session, extra }) => {
  if (!session) return null;

  return (
    <div className="h-[48px] border-b border-gray-700/50 flex-shrink-0 flex items-center justify-between px-6 titlebar-drag">
      <h1 className="font-semibold text-gray-200 text-sm">{session.title}</h1>
      {extra && <div className="titlebar-no-drag">{extra}</div>}
    </div>
  );
};

export default ChatHeader;