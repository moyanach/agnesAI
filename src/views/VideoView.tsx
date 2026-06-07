import React, { useState, useEffect, useRef } from "react";
import {
  Video as VideoIcon,
  Sparkles,
  Sliders,
  Play,
  Trash2,
  Folder,
  Eye,
  AlertTriangle,
  PanelRight,
} from "lucide-react";
import { useVideoStore } from "../stores/videoStore";
import MultiImageUploader from "../components/video/MultiImageUploader";
import RightSidebar from "../components/RightSidebar";
import VideoSidebar from "../components/video/VideoSidebar";

declare global {
  interface Window {
    electronAPI: {
      dbGetModels: () => Promise<any[]>;
      apiGenerateVideo: (params: any) => Promise<any>;
      apiPollVideo: (taskId: string) => Promise<any>;
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

const VideoView = () => {
  const {
    mode,
    setMode,
    prompt,
    setPrompt,
    images,
    width,
    height,
    frameRate,
    numFrames,
  } = useVideoStore();

  const [model, setModel] = useState("agnes-video-v2.0");
  const [videoModels, setVideoModels] = useState<any[]>([]);
  const [steps, setSteps] = useState(30);
  const [seed, setSeed] = useState(-1);
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // 加载视频模型列表
  useEffect(() => {
    const fetchVideoModels = async () => {
      if (window.electronAPI && window.electronAPI.dbGetModels) {
        const list = await window.electronAPI.dbGetModels();
        const filtered = list.filter((m: any) => m.type === "video");
        setVideoModels(filtered);
        if (filtered.length > 0) {
          setModel(filtered[0].id);
        }
      }
    };
    fetchVideoModels();
  }, []);

  // 任务与历史状态
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeTask, setActiveTask] = useState<MediaTask | null>(null);
  const [historyTasks, setHistoryTasks] = useState<MediaTask[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [pollProgress, setPollProgress] = useState(0);

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // 加载历史任务列表
  const loadHistory = async () => {
    if (window.electronAPI) {
      try {
        const tasks = await window.electronAPI.dbGetMediaTasks("video");
        setHistoryTasks(tasks);
        if (tasks.length > 0 && !activeTask) {
          // 选中最新的任务，如果任务在运行中则恢复轮询
          const latest = tasks[0];
          setActiveTask(latest);
          if (latest.status === "queued" || latest.status === "in_progress") {
            startPolling(latest.id);
          }
        }
      } catch (err) {
        console.error("加载视频生成历史失败:", err);
      }
    }
  };

  useEffect(() => {
    loadHistory();
    return () => {
      stopPolling();
    };
  }, []);

  const startPolling = (taskId: string) => {
    setIsGenerating(true);
    setErrorMsg("");
    setPollProgress(0);
    stopPolling();

    let serverErrorCount = 0;
    let networkErrorCount = 0;

    pollIntervalRef.current = setInterval(async () => {
      try {
        const result = await window.electronAPI.apiPollVideo(taskId);

        // 重置错误计数
        serverErrorCount = 0;
        networkErrorCount = 0;

        const updatedTask: MediaTask = {
          id: result.id,
          type: "video",
          prompt: activeTask?.prompt || prompt.trim(),
          local_url: result.localUrl,
          status: result.status,
          created_at: activeTask?.created_at || Date.now(),
        };

        setActiveTask(updatedTask);

        // 提取进度或状态进行UI反馈
        if (result.data) {
          const progress = result.data.progress ?? 0;
          setPollProgress(progress);
        }

        if (result.status === "completed") {
          stopPolling();
          setIsGenerating(false);
          // 刷新整个列表
          const tasks = await window.electronAPI.dbGetMediaTasks("video");
          setHistoryTasks(tasks);
        } else if (result.status === "failed") {
          stopPolling();
          setIsGenerating(false);
          setErrorMsg(result.data?.error?.message || "视频生成失败");
          const tasks = await window.electronAPI.dbGetMediaTasks("video");
          setHistoryTasks(tasks);
        }
      } catch (err: any) {
        // 区分服务端临时错误和网络错误并记录
        const isServerErr =
          err.message.includes("500") ||
          err.message.includes("503") ||
          err.message.toLowerCase().includes("division by zero");
        if (isServerErr) {
          serverErrorCount++;
          if (serverErrorCount > 10) {
            stopPolling();
            setIsGenerating(false);
            setErrorMsg("轮询失败：服务器暂时不可用（重试上限已达）");
          }
        } else {
          networkErrorCount++;
          if (networkErrorCount > 5) {
            stopPolling();
            setIsGenerating(false);
            setErrorMsg("轮询失败：网络连接超时，请检查您的网络环境");
          }
        }
      }
    }, 3000);
  };

  const stopPolling = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim() || isGenerating) return;
    setIsGenerating(true);
    setErrorMsg("");
    setActiveTask(null);
    setPollProgress(0);

    const params: any = {
      prompt: prompt.trim(),
      model,
      width,
      height,
      frame_rate: frameRate,
      num_frames: numFrames,
      steps,
    };

    if (seed !== -1) {
      params.seed = seed;
    }

    // 处理图片入参 (支持单图/多图/关键帧)
    if (mode === "image" && images[0]) {
      params.image_url = images[0];
    } else if ((mode === "multi" || mode === "keyframe") && images.length > 0) {
      // 过滤空槽位
      const validImages = images.filter((img) => img !== "");
      if (validImages.length > 0) {
        if (mode === "keyframe") {
          params.keyframes = validImages;
        } else {
          params.images = validImages;
        }
      }
    }

    try {
      const result = await window.electronAPI.apiGenerateVideo(params);

      const newTask: MediaTask = {
        id: result.id,
        type: "video",
        prompt: result.prompt,
        local_url: "",
        status: result.status,
        created_at: Date.now(),
      };

      setActiveTask(newTask);
      setHistoryTasks((prev) => [newTask, ...prev]);

      // 启动轮询监听状态
      startPolling(result.id);
    } catch (err: any) {
      setErrorMsg(err.message || "提交视频任务失败");
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
        stopPolling();
        setIsGenerating(false);
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

  const aspectRatios = [
    { label: "16:9 横屏", value: "16:9" },
    { label: "9:16 竖屏", value: "9:16" },
    { label: "1:1 正方形", value: "1:1" },
    { label: "4:3 横图", value: "4:3" },
    { label: "3:4 竖图", value: "3:4" },
  ];

  return (
    <>
      {/* --- Column 2: 视频配置表单 (Middle) --- */}
      <div className="w-[360px] h-full bg-[#202020] border-r border-gray-700/50 flex flex-col flex-shrink-0 relative">
        <div className="px-4 border-b border-gray-700/50 titlebar-drag h-[60px] flex items-center justify-between flex-shrink-0">
          <div className="font-bold text-lg text-gray-200">视频生成</div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 pb-5 space-y-6">
          {/* 1. 模式选择器 */}
          <div className="bg-[#1a1a1a] p-1 rounded-lg grid grid-cols-2 gap-1 border border-gray-700/50">
            {(
              [
                { id: "text", label: "文本生视频" },
                { id: "image", label: "图片生视频" },
                { id: "multi", label: "多图视频" },
                { id: "keyframe", label: "关键帧动画" },
              ] as const
            ).map((m) => (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                className={`py-1.5 text-[12px] font-medium rounded-md transition-colors ${
                  mode === m.id
                    ? "bg-indigo-600 text-white"
                    : "text-gray-400 hover:text-gray-200 hover:bg-gray-800"
                }`}>
                {m.label}
              </button>
            ))}
          </div>

          {/* 2. 图片上传 */}
          <MultiImageUploader />

          {/* 4. 视频设置 */}
          <div className="space-y-4">
            <label className="flex items-center gap-1.5 text-sm font-medium text-gray-300 border-b border-gray-750 pb-2">
              <Sliders size={14} className="text-indigo-400" />
              参数设置
            </label>

            {/* 画面比例 */}
            <div className="space-y-1.5">
              <span className="text-xs text-gray-400 font-medium">
                画面比例
              </span>
              <div className="grid grid-cols-2 gap-2">
                {aspectRatios.map((item) => (
                  <button
                    key={item.value}
                    onClick={() => setAspectRatio(item.value)}
                    className={`py-1.5 rounded-md text-xs font-medium border transition-colors ${
                      aspectRatio === item.value
                        ? "bg-indigo-600 border-indigo-500 text-white"
                        : "bg-[#1a1a1a] border-gray-700 text-gray-400 hover:text-gray-200"
                    }`}>
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 步数 & 种子 */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <span className="text-xs text-gray-400 font-medium">步数</span>
                <input
                  type="number"
                  value={steps}
                  onChange={(e) => setSteps(parseInt(e.target.value) || 30)}
                  className="w-full bg-[#1a1a1a] border border-gray-700 rounded-lg p-2 text-xs text-gray-200 outline-none"
                />
              </div>
              <div className="space-y-1">
                <span className="text-xs text-gray-400 font-medium">种子</span>
                <input
                  type="number"
                  placeholder="默认随机"
                  value={seed === -1 ? "" : seed}
                  onChange={(e) =>
                    setSeed(e.target.value ? parseInt(e.target.value) : -1)
                  }
                  className="w-full bg-[#1a1a1a] border border-gray-700 rounded-lg p-2 text-xs text-gray-200 outline-none"
                />
              </div>
            </div>

            {/* 提示信息 */}
            <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-[11px] text-indigo-300 flex items-start gap-2 leading-relaxed">
              <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
              <span>
                当前生成帧数为 <b>{numFrames} 帧</b>，帧率为{" "}
                <b>{frameRate} fps</b>。视频大小已根据比例自动适配最佳渲染效果。
              </span>
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
              {isGenerating
                ? `视频生成中（当前进度: ${Math.round(pollProgress * 100)}%）`
                : "生成状态：已就绪"}
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
                title={sidebarOpen ? "关闭侧边栏" : "打开侧边栏"}>
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
                <div className="flex flex-col items-center justify-center space-y-5 max-w-xs text-center">
                  <div className="relative flex items-center justify-center">
                    <div className="w-16 h-16 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
                    <span className="absolute text-[11px] font-bold text-indigo-400">
                      {Math.round(pollProgress * 100)}%
                    </span>
                  </div>
                  <div className="space-y-1">
                    <div className="text-sm font-semibold text-gray-300">
                      {activeTask?.status === "queued"
                        ? "队列中，等待服务响应"
                        : "正在进行画面渲染"}
                    </div>
                    <div className="text-xs text-gray-500">
                      生成过程通常需要 1-2 分钟，请勿关闭软件
                    </div>
                  </div>
                </div>
              )}

              {!isGenerating &&
                activeTask &&
                activeTask.status === "completed" && (
                  <div className="relative max-h-full max-w-full flex flex-col items-center group">
                    <video
                      src={activeTask.local_url}
                      controls
                      autoPlay
                      loop
                      className="max-h-[380px] md:max-h-[460px] aspect-video object-contain rounded-xl shadow-xl border border-gray-800 bg-black"
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

              {!isGenerating &&
                activeTask &&
                activeTask.status === "failed" && (
                  <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-6 rounded-xl text-sm max-w-md text-center space-y-2">
                    <AlertTriangle size={32} className="mx-auto text-red-400" />
                    <h4 className="font-semibold text-gray-200">生成失败</h4>
                    <p className="text-xs text-gray-400">
                      {errorMsg || "服务器处理发生错误，请重新提交"}
                    </p>
                  </div>
                )}

              {!isGenerating && !errorMsg && !activeTask && (
                <div className="border border-dashed border-gray-700/80 rounded-2xl p-10 flex flex-col items-center justify-center text-gray-500 bg-[#1e1e1e] max-w-md w-full">
                  <VideoIcon
                    size={48}
                    className="mb-4 opacity-20 text-indigo-400"
                  />
                  <p className="font-semibold text-gray-300">等待生成视频</p>
                  <p className="text-xs mt-1.5 text-center text-gray-500 leading-relaxed">
                    在左侧输入场景和镜头提示，提供图像关键帧，我们将利用 AI
                    模型渲染出流畅、高清的动画片段。
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
                  placeholder="描述视频内容、动作、场景、镜头运动..."
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
                  {videoModels.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name || m.model_id}
                    </option>
                  ))}
                  {videoModels.length === 0 && (
                    <option value="agnes-video-v2.0">agnes-video-v2.0</option>
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
        onClose={() => setSidebarOpen(false)}>
        <VideoSidebar
          tasks={historyTasks}
          activeTaskId={activeTask?.id || null}
          onSelect={(task) => {
            setActiveTask(task);
            if (task.status === "queued" || task.status === "in_progress") {
              startPolling(task.id);
            } else {
              stopPolling();
              setIsGenerating(false);
            }
          }}
          onDelete={(id) => {
            handleDelete(id, { stopPropagation: () => {} } as any);
          }}
        />
      </RightSidebar>
    </>
  );
};

export default VideoView;
