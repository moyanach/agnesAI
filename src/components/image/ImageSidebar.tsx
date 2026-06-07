import React from "react";
import { Trash2, Eye, Image as ImageIcon } from "lucide-react";

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

const ImageSidebar: React.FC<Props> = ({
  tasks,
  activeTaskId,
  onSelect,
  onDelete,
}) => {
  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm("确定要删除这张图片吗？")) {
      onDelete(id);
    }
  };

  return (
    <>
      <div className="text-[10px] text-gray-500 font-medium mb-2 uppercase tracking-wider">
        共 {tasks.length} 张
      </div>
      {tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-gray-600">
          <ImageIcon size={32} className="mb-2 opacity-30" />
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
              <img
                src={task.local_url}
                alt={task.prompt}
                className="w-full h-24 object-cover bg-black/40"
              />
              {/* 遮罩 hover */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                <Eye
                  size={18}
                  className="text-white opacity-0 group-hover:opacity-100 transition-opacity"
                />
              </div>
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

export default ImageSidebar;
