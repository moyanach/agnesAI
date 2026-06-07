import React from "react";

interface Props {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

const RightSidebar: React.FC<Props> = ({ open, title, onClose, children }) => {
  return (
    <div
      className={`h-full flex-shrink-0 overflow-hidden transition-all duration-200 ${
        open ? "w-[280px] border-l border-gray-700/50 bg-[#202020]" : "w-0"
      }`}
    >
      {open && (
        <div className="h-full w-[280px] flex flex-col bg-[#202020]">
          {/* 标题栏 */}
          <div className="h-[48px] border-b border-gray-700/50 flex items-center justify-between px-4 flex-shrink-0">
            <span className="text-xs font-semibold text-gray-300 tracking-wide uppercase">
              {title}
            </span>
            <button
              onClick={onClose}
              className="p-1 rounded-md text-gray-500 hover:text-gray-200 hover:bg-gray-700 transition-colors"
              title="关闭侧边栏"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                <polyline points="10 17 15 12 10 7" />
                <line x1="15" y1="12" x2="3" y2="12" />
              </svg>
            </button>
          </div>

          {/* 内容区 */}
          <div className="flex-1 overflow-y-auto p-3">{children}</div>
        </div>
      )}
    </div>
  );
};

export default RightSidebar;
