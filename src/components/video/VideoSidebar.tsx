import React from "react";
import { Trash2, Eye, Video as VideoIcon, AlertTriangle } from "lucide-react";

interface MediaTask {
  id: string;
  type: string;
  prompt: string;
  local_url: string;
  status: string;
  created_at: number;
}

interface Props {
  tasks: MediaTask[];
  activeTaskId: string | null;
  onSelect: (task: MediaTask) => void;
  onDelete: (id: string) => void;
}

const VideoSidebar: React.FC<Props> = ({
  tasks,
  activeTaskId,
  onSelect,
  onDelete,
}) => {
  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm("确定要删除这条视频记录吗？")) {
      onDelete(id);
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return (
          <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            已完成
          </span>
        );
      case "queued":
        return (
          <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/30">
            排队中
          </span>
        );
      case "in_progress":
        return (
          <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
            生成中
          </span>
        );
      case "failed":
        return (
          <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-red-500/20 text-red-400 border border-red-500/30">
            失败
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <>
      <div className="text-[10px] text-gray-500 font-medium mb-2 uppercase tracking-wider">
        共 {tasks.length} 条
      </div>
      {tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-gray-600">
          <VideoIcon size={32} className="mb-2 opacity-30" />
          <span className="text-xs">暂无历史记录</span>
        </div>
      ) : (
        <div className="space-y-2">
          {tasks.map((task) => (
            <div
              key={task.id}
              onClick={() => onSelect(task)}
              className={`relative rounded-lg overflow-hidden cursor-pointer border transition-all group ${
                activeTaskId === task.id
                  ? "border-indigo-500 ring-1 ring-indigo-500/50"
                  : "border-gray-700/50 hover:border-gray-500"
              }`}
            >
              {/* 缩略图 */}
              {task.status === "completed" && task.local_url ? (
                <video
                  src={task.local_url}
                  className="w-full h-24 object-cover bg-black/40 pointer-events-none"
                  muted
                  loop
                  onMouseEnter={(e) => (e.target as HTMLVideoElement).play()}
                  onMouseLeave={(e) => {
                    const v = e.target as HTMLVideoElement;
                    v.pause();
                    v.currentTime = 0;
                  }}
                />
              ) : (
                <div className="w-full h-24 flex flex-col items-center justify-center bg-gray-900/60 gap-1">
                  {task.status === "queued" || task.status === "in_progress" ? (
                    <>
                      <div className="w-5 h-5 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div>
                      <span className="text-[10px] text-gray-500">
                        {task.status === "queued" ? "排队中..." : "生成中..."}
                      </span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle size={16} className="text-red-400" />
                      <span className="text-[10px] text-red-400">生成失败</span>
                    </>
                  )}
                </div>
              )}

              {/* 状态标签 */}
              <div className="absolute top-1.5 left-1.5">
                {statusBadge(task.status)}
              </div>

              {/* 遮罩 hover */}
              {task.status === "completed" && (
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                  <Eye
                    size={18}
                    className="text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  />
                </div>
              )}

              {/* 删除按钮 */}
              <button
                onClick={(e) => handleDelete(task.id, e)}
                className="absolute top-1.5 right-1.5 p-1 bg-black/60 hover:bg-red-500/80 text-white rounded-md opacity-0 group-hover:opacity-100 transition-all"
              >
                <Trash2 size={12} />
              </button>

              {/* 底部提示词 */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2 pt-5">
                <p className="text-[10px] text-gray-300 truncate leading-tight">
                  {task.prompt || "无提示词"}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
};

export default VideoSidebar;
