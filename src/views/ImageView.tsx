import React, { useState, useEffect } from "react";
import {
  Image as ImageIcon,
  Sparkles,
  Sliders,
  Play,
  Trash2,
  Folder,
  Eye,
  PanelRight,
} from "lucide-react";
import { useImageStore } from "../stores/imageStore";
import ImageUploader from "../components/ImageUploader";
import RightSidebar from "../components/RightSidebar";
import ImageSidebar from "../components/image/ImageSidebar";

declare global {
  interface Window {
    electronAPI: {
      dbGetModels: () => Promise<any[]>;
      apiGenerateImage: (params: any) => Promise<any>;
      dbGetMediaTasks: (type: string) => Promise<any[]>;
      dbDeleteMediaTask: (id: string) => Promise<boolean>;
      showInFolder: (path: string) => void;
    };
  }
}

interface MediaTask {
  id: string;
  type: string;
  prompt: string;
  local_url: string;
  status: string;
  created_at: number;
}

const ImageView = () => {
  const {
    mode,
    setMode,
    prompt,
    setPrompt,
    referenceImage,
    width,
    height,
    setWidth,
    setHeight,
    aspectRatio,
    setAspectRatio,
  } = useImageStore();

  const [model, setModel] = useState("agnes-image-2.1-flash");
  const [imageModels, setImageModels] = useState<any[]>([]);
  const [steps, setSteps] = useState(25);
  const [seed, setSeed] = useState(-1);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // 加载图像模型列表
  useEffect(() => {
    const fetchImageModels = async () => {
      if (window.electronAPI && window.electronAPI.dbGetModels) {
        const list = await window.electronAPI.dbGetModels();
        const filtered = list.filter((m: any) => m.type === "image");
        setImageModels(filtered);
        if (filtered.length > 0) {
          setModel(filtered[0].id);
        }
      }
    };
    fetchImageModels();
  }, []);

  // 任务状态
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeTask, setActiveTask] = useState<MediaTask | null>(null);
  const [historyTasks, setHistoryTasks] = useState<MediaTask[]>([]);
  const [errorMsg, setErrorMsg] = useState("");

  // 加载历史任务列表
  const loadHistory = async () => {
    if (window.electronAPI) {
      try {
        const tasks = await window.electronAPI.dbGetMediaTasks("image");
        setHistoryTasks(tasks);
        if (tasks.length > 0 && !activeTask) {
          setActiveTask(tasks[0]);
        }
      } catch (err) {
        console.error("加载图像生成历史失败:", err);
      }
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  // 按 Escape 关闭图片预览
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPreviewUrl(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleGenerate = async () => {
    if (!prompt.trim() || isGenerating) return;
    setIsGenerating(true);
    setErrorMsg("");
    setActiveTask(null);

    const params: any = {
      prompt: prompt.trim(),
      model,
      width,
      height,
      num_inference_steps: steps,
    };

    if (seed !== -1) {
      params.seed = seed;
    }

    if (mode === "img2img" && referenceImage) {
      params.image_url = referenceImage;
    }

    try {
      const result = await window.electronAPI.apiGenerateImage(params);
      const newTask: MediaTask = {
        id: result.id,
        type: "image",
        prompt: result.prompt,
        local_url: result.localUrl,
        status: result.status,
        created_at: Date.now(),
      };
      setActiveTask(newTask);
      setHistoryTasks((prev) => [newTask, ...prev]);
    } catch (err: any) {
      setErrorMsg(err.message || "图像生成失败，请稍后重试");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.electronAPI) return;
    try {
      await window.electronAPI.dbDeleteMediaTask(id);
      setHistoryTasks((prev) => prev.filter((t) => t.id !== id));
      if (activeTask?.id === id) {
        setActiveTask(null);
      }
    } catch (err) {
      console.error("删除任务失败:", err);
    }
  };

  const handleOpenFolder = (localUrl: string) => {
    if (window.electronAPI) {
      window.electronAPI.showInFolder(localUrl);
    }
  };

  // 比例尺寸配置选项
  const aspectRatios = [
    { label: "1:1 正方形", value: "1:1", w: 1024, h: 1024 },
    { label: "3:4 竖图", value: "3:4", w: 768, h: 1024 },
    { label: "4:3 横图", value: "4:3", w: 1024, h: 768 },
    { label: "9:16 竖屏", value: "9:16", w: 720, h: 1280 },
    { label: "16:9 横屏", value: "16:9", w: 1280, h: 720 },
  ];

  return (
    <>
      {/* --- Column 2: 图像配置表单 (Middle) --- */}
      <div className="w-[360px] h-full bg-[#202020] border-r border-gray-700/50 flex flex-col flex-shrink-0 relative">
        <div className="px-4 border-b border-gray-700/50 titlebar-drag h-[60px] flex items-center justify-between flex-shrink-0">
          <div className="font-bold text-lg text-gray-200">图像生成</div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 pb-5 space-y-6">
          {/* 1. 模式选择器 */}
          <div className="bg-[#1a1a1a] p-1 rounded-lg flex border border-gray-700/50">
            <button
              onClick={() => setMode("txt2img")}
              className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${
                mode === "txt2img"
                  ? "bg-indigo-600 text-white"
                  : "text-gray-400 hover:text-gray-200"
              }`}>
              文本生图
            </button>
            <button
              onClick={() => setMode("img2img")}
              className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${
                mode === "img2img"
                  ? "bg-indigo-600 text-white"
                  : "text-gray-400 hover:text-gray-200"
              }`}>
              图生图
            </button>
          </div>

          {/* 2. 参考图上传 */}
          {mode === "img2img" && <ImageUploader />}

          {/* 3. 参数设置 */}
          <div className="space-y-4">
            <label className="flex items-center gap-1.5 text-sm font-medium text-gray-300 border-b border-gray-750 pb-2">
              <Sliders size={14} className="text-indigo-400" />
              参数设置
            </label>
            {/* 
            <!-- 画面比例 --> */}
            <div className="space-y-1.5">
              <span className="text-xs text-gray-400 font-medium">
                画面比例
              </span>
              <div className="grid grid-cols-3 gap-2">
                {aspectRatios.map((item) => (
                  <button
                    key={item.value}
                    onClick={() => {
                      setAspectRatio(item.value as any);
                      setWidth(item.w);
                      setHeight(item.h);
                    }}
                    className={`py-1.5 rounded-md text-xs font-medium border transition-colors ${
                      aspectRatio === item.value
                        ? "bg-indigo-600 border-indigo-500 text-white"
                        : "bg-[#1a1a1a] border-gray-700 text-gray-400 hover:text-gray-200"
                    }`}>
                    {item.value}
                  </button>
                ))}
              </div>
            </div>

            {/* 自定义分辨率 */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <span className="text-[10px] text-gray-400 uppercase font-bold">
                  宽度
                </span>
                <input
                  type="number"
                  value={width}
                  onChange={(e) => setWidth(parseInt(e.target.value) || 1024)}
                  className="w-full bg-[#1a1a1a] border border-gray-700 rounded-lg p-2 text-xs text-gray-200 outline-none"
                />
              </div>
              <div className="space-y-1">
                <span className="text-[10px] text-gray-400 uppercase font-bold">
                  高度
                </span>
                <input
                  type="number"
                  value={height}
                  onChange={(e) => setHeight(parseInt(e.target.value) || 1024)}
                  className="w-full bg-[#1a1a1a] border border-gray-700 rounded-lg p-2 text-xs text-gray-200 outline-none"
                />
              </div>
            </div>

            {/* 迭代步数 */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-gray-400">
                <span>推理步数</span>
                <span className="font-semibold text-gray-300">{steps}</span>
              </div>
              <input
                type="range"
                min="10"
                max="50"
                value={steps}
                onChange={(e) => setSteps(parseInt(e.target.value))}
                className="w-full accent-indigo-500 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            {/* 种子数 */}
            <div className="space-y-1.5">
              <span className="text-xs text-gray-400 font-medium">
                随机种子
              </span>
              <input
                type="number"
                placeholder="默认 -1 代表随机"
                value={seed === -1 ? "" : seed}
                onChange={(e) =>
                  setSeed(e.target.value ? parseInt(e.target.value) : -1)
                }
                className="w-full bg-[#1a1a1a] border border-gray-700 rounded-lg p-2 text-xs text-gray-200 outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* --- Column 3: 预览与结果区 (Right) --- */}
      <div className="flex-1 h-full flex bg-[#1a1a1a] overflow-hidden">
        <div className="flex-1 h-full flex flex-col overflow-hidden">
        {/* 顶部状态栏 */}
        <div className="h-[60px] border-b border-gray-700/50 flex-shrink-0 flex items-center justify-between px-6 titlebar-drag">
          <div className="text-xs text-gray-400 font-medium">
            {isGenerating ? "生成状态：正在推理..." : "生成状态：已就绪"}
          </div>
          <div className="text-xs text-gray-500 flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${isGenerating ? "bg-amber-500" : "bg-emerald-500"}`}></span>{" "}
            API 就绪
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className={`titlebar-no-drag p-1.5 rounded-md transition-colors ${
                sidebarOpen
                  ? "bg-indigo-600/20 text-indigo-400"
                  : "text-gray-500 hover:text-gray-200 hover:bg-gray-700"
              }`}
              title={sidebarOpen ? "关闭侧边栏" : "打开侧边栏"}
            >
              <PanelRight size={16} />
            </button>
          </div>
        </div>

        {/* 主预览区 */}
        <div className="flex-1 p-6 flex flex-col overflow-hidden justify-between">
          <div className="flex-1 flex flex-col justify-center items-center overflow-hidden">
            {errorMsg && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl text-sm max-w-md text-center">
                {errorMsg}
              </div>
            )}

            {isGenerating && (
              <div className="flex flex-col items-center justify-center space-y-4">
                <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
                <div className="text-sm text-gray-400">
                  正在生成，请耐心等待...
                </div>
              </div>
            )}

            {!isGenerating && activeTask && (
              <div className="relative max-h-full max-w-full flex flex-col items-center group">
                <img
                  src={activeTask.local_url}
                  alt="Generated Output"
                  onClick={() => setPreviewUrl(activeTask.local_url)}
                  className="max-h-[380px] md:max-h-[460px] object-contain rounded-xl shadow-xl border border-gray-800 cursor-pointer hover:brightness-90 transition-all"
                />
                <div className="mt-4 flex gap-3">
                  <button
                    onClick={() => handleOpenFolder(activeTask.local_url)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg text-xs font-semibold shadow transition-colors">
                    <Folder size={14} />
                    在文件夹中显示
                  </button>
                </div>
              </div>
            )}

            {!isGenerating && !errorMsg && !activeTask && (
              <div className="border border-dashed border-gray-700/80 rounded-2xl p-10 flex flex-col items-center justify-center text-gray-500 bg-[#1e1e1e] max-w-md w-full">
                <ImageIcon
                  size={48}
                  className="mb-4 opacity-20 text-indigo-400"
                />
                <p className="font-semibold text-gray-300">等待生成图像</p>
                <p className="text-xs mt-1.5 text-center text-gray-500 leading-relaxed">
                  在左侧输入提示词，选择合适的比例、模型和参数，生成的结果将在这里实时呈现。
                </p>
              </div>
            )}
          </div>
        </div>

        {/* 底部输入区：提示词 + 模型选择 + 生成按钮 */}
        <div className="flex-shrink-0 border-t border-gray-700/50 bg-[#1a1a1a] p-3 pt-2">
          <div className="bg-[#2a2a2a] border border-gray-600/50 rounded-xl focus-within:border-indigo-500/70 focus-within:ring-1 focus-within:ring-indigo-500/50 transition-all">
            {/* 提示词输入 */}
            <div className="p-2 pb-0">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="描述图像主体、场景、光线与艺术风格..."
                className="w-full max-h-32 min-h-[40px] bg-transparent text-gray-200 resize-none outline-none px-2 py-2 text-sm scroll-smooth"
                rows={1}
              />
            </div>
            {/* 底部栏：模型选择左对齐，生成按钮右对齐 */}
            <div className="flex items-center gap-2 px-3 pb-2">
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="bg-[#242424] border border-gray-700 rounded-md px-2 py-1 text-xs text-gray-400 outline-none focus:border-indigo-500 transition-colors cursor-pointer">
                {imageModels.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name || m.model_id}
                  </option>
                ))}
                {imageModels.length === 0 && (
                  <option value="agnes-image-2.1-flash">
                    agnes-image-2.1-flash
                  </option>
                )}
              </select>
              <div className="ml-auto">
                <button
                  onClick={handleGenerate}
                  disabled={!prompt.trim() || isGenerating}
                  className="p-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:hover:bg-indigo-600 text-white rounded-lg transition-colors flex items-center justify-center">
                  {isGenerating ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    <Play size={16} fill="currentColor" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>

      {/* 右侧边栏 */}
      <RightSidebar
        open={sidebarOpen}
        title="生成历史"
        onClose={() => setSidebarOpen(false)}
      >
        <ImageSidebar
          tasks={historyTasks}
          activeTaskId={activeTask?.id || null}
          onSelect={(task) => setActiveTask(task)}
          onDelete={(id) => {
            handleDelete(id, { stopPropagation: () => {} } as any);
          }}
        />
      </RightSidebar>

      {/* 图片放大预览遮罩 */}
      {previewUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-6"
          onClick={() => setPreviewUrl(null)}
        >
          <button
            onClick={() => setPreviewUrl(null)}
            className="absolute top-4 right-4 w-10 h-10 bg-gray-800/80 hover:bg-gray-700 text-gray-300 rounded-full flex items-center justify-center text-xl transition-colors z-10"
          >
            ✕
          </button>
          <img
            src={previewUrl}
            alt="Preview"
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
};

export default ImageView;
