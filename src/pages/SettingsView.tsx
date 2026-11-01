import React, { useState, useEffect } from "react";
import {
  Settings as SettingsIcon,
  FolderOpen,
  Save,
  Check,
  Cpu,
  Trash2,
  Pencil,
  Globe,
  Sun,
  Moon,
  Monitor,
} from "lucide-react";
import { loadTheme, setTheme as applyThemePersist, type ThemeMode } from "../theme";
import { useAppStore } from "../stores/appStore";

// 声明 Electron 注入的全局 API 类型
declare global {
  interface Window {
    electronAPI: {
      getConfig: (key: string) => Promise<string | null>;
      setConfig: (key: string, value: string) => Promise<boolean>;
      selectSaveDirectory: () => Promise<string | null>;
      showInFolder: (path: string) => void;
      dbGetModels: () => Promise<any[]>;
      dbAddModel: (model: {
        id: string;
        modelId: string;
        name: string;
        type: string;
        provider: string;
        baseUrl: string;
        apiKey: string;
      }) => Promise<boolean>;
      dbDeleteModel: (id: string) => Promise<boolean>;
    };
  }
}

const SettingsView = () => {
  const [activeTab, setActiveTab] = useState<"general" | "models" | "search">("models");

  // 配置状态
  const [savePath, setSavePath] = useState("");

  // 搜索配置状态
  const [searchProvider, setSearchProvider] = useState("duckduckgo");
  const [searchApiKey, setSearchApiKey] = useState("");
  const [searchMaxResults, setSearchMaxResults] = useState("3");

  // 模型管理配置状态
  const [models, setModels] = useState<any[]>([]);
  const [editingModelId, setEditingModelId] = useState<string | null>(null);
  const [newModelId, setNewModelId] = useState("");
  const [newModelName, setNewModelName] = useState("");
  const [newModelType, setNewModelType] = useState("chat");
  const [newModelProvider, setNewModelProvider] = useState("agnes");
  const [newModelBaseUrl, setNewModelBaseUrl] = useState("https://apihub.agnes-ai.com/v1");
  const [newModelApiKey, setNewModelApiKey] = useState("");

  // 主题状态
  const [currentTheme, setCurrentTheme] = useState<ThemeMode>("system");
  const { theme, setTheme: setStoreTheme } = useAppStore();

  // 提示状态
  const [toastMsg, setToastMsg] = useState("");

  const loadModels = async () => {
    if (window.electronAPI && window.electronAPI.dbGetModels) {
      const list = await window.electronAPI.dbGetModels();
      setModels(list);
    }
  };

  const handleEditModel = (model: any) => {
    setEditingModelId(model.id);
    setNewModelId(model.model_id);
    setNewModelName(model.name || "");
    setNewModelType(model.type);
    setNewModelProvider(model.provider);
    setNewModelBaseUrl(model.base_url);
    setNewModelApiKey(model.api_key || "");
  };

  const handleCancelEdit = () => {
    setEditingModelId(null);
    setNewModelId("");
    setNewModelName("");
    setNewModelType("chat");
    setNewModelProvider("agnes");
    setNewModelBaseUrl("https://apihub.agnes-ai.com/v1");
    setNewModelApiKey("");
  };

  // 组件挂载时，从 SQLite 读取现有配置
  useEffect(() => {
    const loadConfigs = async () => {
      if (!window.electronAPI) return;
      const savedPath = await window.electronAPI.getConfig("save_path");
      if (savedPath) setSavePath(savedPath);

      const provider = await window.electronAPI.getConfig("search_provider");
      if (provider) setSearchProvider(provider);

      const apiKey = await window.electronAPI.getConfig("search_api_key");
      if (apiKey) setSearchApiKey(apiKey);

      const maxResults = await window.electronAPI.getConfig("search_max_results");
      if (maxResults) setSearchMaxResults(maxResults);

      // 加载主题偏好
      const savedTheme = await loadTheme();
      setCurrentTheme(savedTheme);
      setStoreTheme(savedTheme);
    };
    loadConfigs();
    loadModels();
  }, []);

  const handleSaveSearchConfig = async () => {
    if (!window.electronAPI) return;
    try {
      await window.electronAPI.setConfig("search_provider", searchProvider);
      await window.electronAPI.setConfig("search_api_key", searchApiKey.trim());
      await window.electronAPI.setConfig("search_max_results", searchMaxResults);
      showToast("搜索配置保存成功");
    } catch (e) {
      showToast("配置保存失败");
    }
  };

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 3000);
  };

  // 呼出原生文件夹选择器
  const handleSelectPath = async () => {
    if (!window.electronAPI) return;
    const path = await window.electronAPI.selectSaveDirectory();
    if (path) {
      setSavePath(path);
      showToast("默认存储路径已更新");
    }
  };

  // 添加/更新模型
  const handleAddModel = async () => {
    if (!newModelId.trim()) {
      showToast("模型 ID 不能为空");
      return;
    }
    if (!newModelBaseUrl.trim()) {
      showToast("Base URL 不能为空");
      return;
    }

    if (window.electronAPI && window.electronAPI.dbAddModel) {
      await window.electronAPI.dbAddModel({
        id: editingModelId || `model_${Date.now()}`,
        modelId: newModelId.trim(),
        name: newModelName.trim() || newModelId.trim(),
        type: newModelType,
        provider: newModelProvider,
        baseUrl: newModelBaseUrl.trim(),
        apiKey: newModelApiKey.trim(),
      });
      setNewModelId("");
      setNewModelName("");
      setNewModelApiKey("");
      const isEdit = !!editingModelId;
      setEditingModelId(null);
      showToast(isEdit ? "模型配置已更新" : "模型添加成功");
      loadModels();
    }
  };

  // 删除模型
  const handleDeleteModel = async (id: string) => {
    if (window.electronAPI && window.electronAPI.dbDeleteModel) {
      await window.electronAPI.dbDeleteModel(id);
      showToast("模型已删除");
      loadModels();
    }
  };

  return (
    <>
      {/* --- Column 2: 设置目录 (Middle) --- */}
      <div className="w-80 h-full bg-[#202020] border-r border-gray-700/50 flex flex-col flex-shrink-0">
        <div className="px-4 font-bold text-lg border-b border-gray-700/50 titlebar-drag h-[60px] flex items-center">
          设置
        </div>

        <div className="flex-1 p-2 space-y-1">
          <button
            onClick={() => setActiveTab("models")}
            className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${
              activeTab === "models"
                ? "bg-indigo-600 text-white"
                : "hover:bg-gray-800 text-gray-300"
            }`}>
            <Cpu size={18} className="opacity-80" />
            <span className="font-medium text-sm">模型配置</span>
          </button>

          <button
            onClick={() => setActiveTab("search")}
            className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${
              activeTab === "search"
                ? "bg-indigo-600 text-white"
                : "hover:bg-gray-800 text-gray-300"
            }`}>
            <Globe size={18} className="opacity-80" />
            <span className="font-medium text-sm">搜索配置</span>
          </button>

          <button
            onClick={() => setActiveTab("general")}
            className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${
              activeTab === "general"
                ? "bg-indigo-600 text-white"
                : "hover:bg-gray-800 text-gray-300"
            }`}>
            <SettingsIcon size={18} className="opacity-80" />
            <span className="font-medium text-sm">通用设置</span>
          </button>
        </div>
      </div>

      {/* --- Column 3: 设置详情区 (Right) --- */}
      <div className="flex-1 h-full flex flex-col bg-[#1a1a1a] relative">
        {/* Toast 提示 */}
        <div
          className={`absolute top-6 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-emerald-500/90 text-white px-4 py-2 rounded-full shadow-lg transition-all duration-300 z-50 ${toastMsg ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4 pointer-events-none"}`}>
          <Check size={16} />
          <span className="text-sm font-medium">{toastMsg}</span>
        </div>

        {/* Top Header */}
        <div className="h-[60px] border-b border-gray-700/50 flex-shrink-0 flex items-center px-8 titlebar-drag">
          <h1 className="font-semibold text-gray-200">
            {activeTab === "models" ? "模型配置" : activeTab === "search" ? "搜索配置" : "通用设置"}
          </h1>
        </div>

        {/* Settings Content */}
        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-2xl space-y-8">

            {activeTab === "general" && (
              <div className="space-y-6">
                {/* 主题设置 */}
                <div className="bg-[#242424] border border-gray-700/50 rounded-xl p-6 shadow-sm">
                  <h3 className="text-sm font-semibold text-gray-200 mb-4 border-b border-gray-700/50 pb-2">
                    主题设置
                  </h3>
                  <div className="flex gap-3">
                    {([
                      { value: "light" as const, label: "亮色", icon: Sun },
                      { value: "dark" as const, label: "暗色", icon: Moon },
                      { value: "system" as const, label: "随系统", icon: Monitor },
                    ]).map(({ value, label, icon: Icon }) => (
                      <button
                        key={value}
                        onClick={async () => {
                          setCurrentTheme(value);
                          setStoreTheme(value);
                          await applyThemePersist(value);
                        }}
                        className={`flex-1 flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                          currentTheme === value
                            ? "border-indigo-500 bg-indigo-500/10 text-indigo-300"
                            : "border-gray-700/50 bg-[#1a1a1a] text-gray-400 hover:border-gray-500 hover:text-gray-200"
                        }`}
                      >
                        <Icon size={24} />
                        <span className="text-xs font-medium">{label}</span>
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-3">
                    {currentTheme === "system"
                      ? "跟随操作系统的外观设置自动切换亮色/暗色主题。"
                      : currentTheme === "dark"
                        ? "使用深色背景显示界面，适合在光线较暗的环境下使用。"
                        : "使用浅色背景显示界面，适合在光线充足的环境下使用。"}
                  </p>
                </div>

                {/* Agent 配置文件目录 */}
                <div className="bg-[#242424] border border-gray-700/50 rounded-xl p-6 shadow-sm">
                  <h3 className="text-sm font-semibold text-gray-200 mb-4 border-b border-gray-700/50 pb-2">
                    Agent 配置根目录 (~/.agnes/)
                  </h3>
                  <div className="space-y-4">
                    <p className="text-xs text-gray-400">
                      所有配置完全透明可读，包含 <code>config.json</code>（模型配置）、<code>mcp.json</code>（标准 MCP 服务器）、<code>skills/</code>（自定义技能）与 <code>memory/</code>（长期记忆）。
                    </p>
                    <div className="flex gap-3 items-center">
                      <input
                        type="text"
                        readOnly
                        value="~/.agnes/"
                        className="flex-1 bg-[#1a1a1a] border border-gray-600 rounded-lg px-4 py-2 text-gray-300 font-mono text-xs"
                      />
                    </div>
                  </div>
                </div>

                {/* 文件保存目录 */}
                <div className="bg-[#242424] border border-gray-700/50 rounded-xl p-6 shadow-sm">
                  <h3 className="text-sm font-semibold text-gray-200 mb-4 border-b border-gray-700/50 pb-2">
                    文件输出默认目录
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        默认保存位置
                      </label>
                      <div className="flex gap-3">
                        <input
                          type="text"
                          readOnly
                          value={savePath || "系统默认目录/AgnesAI"}
                          className="flex-1 bg-[#1a1a1a] border border-gray-600 rounded-lg px-4 py-2.5 text-gray-400 outline-none font-mono text-sm"
                        />
                        <button
                          onClick={handleSelectPath}
                          className="flex flex-shrink-0 items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white px-4 py-2.5 rounded-lg font-medium transition-colors">
                          <FolderOpen size={18} />
                          更改目录
                        </button>
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        Agent 导出的文件与文档将默认保存至此目录
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "search" && (
              <div className="bg-[#242424] border border-gray-700/50 rounded-xl p-6 shadow-sm">
                <h3 className="text-sm font-semibold text-gray-200 mb-4 border-b border-gray-700/50 pb-2">
                  联网检索设置
                </h3>
                <div className="space-y-6">
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1.5">
                      搜索引擎服务商 (Search Provider)
                    </label>
                    <select
                      value={searchProvider}
                      onChange={(e) => setSearchProvider(e.target.value)}
                      className="w-full bg-[#1a1a1a] border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-200 outline-none focus:border-indigo-500 transition-all font-medium"
                    >
                      <option value="duckduckgo">DuckDuckGo (内置免费 / 无需配置)</option>
                      <option value="tavily">Tavily Search API (大模型推荐)</option>
                    </select>
                    <p className="text-[11px] text-gray-500 mt-1.5 font-medium leading-relaxed">
                      {searchProvider === "duckduckgo" 
                        ? "使用内置的 DuckDuckGo Lite 抓取服务，免费且不需要配置任何密钥。"
                        : "Tavily 是专门为 AI Agent 优化的搜索引擎，能够精准抽取页面关键正文，注册可获取每月 1000 次免费搜索。"}
                    </p>
                  </div>

                  {searchProvider === "tavily" && (
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1.5 font-mono">
                        Tavily API Key
                      </label>
                      <input
                        type="password"
                        value={searchApiKey}
                        onChange={(e) => setSearchApiKey(e.target.value)}
                        placeholder="tvly-..."
                        className="w-full bg-[#1a1a1a] border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-200 outline-none focus:border-indigo-500 transition-all font-mono"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1.5">
                      最大网页搜索数量 (Max Search Results)
                    </label>
                    <select
                      value={searchMaxResults}
                      onChange={(e) => setSearchMaxResults(e.target.value)}
                      className="w-full bg-[#1a1a1a] border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-200 outline-none focus:border-indigo-500 transition-all font-medium"
                    >
                      <option value="1">爬取 1 个主要网页</option>
                      <option value="3">爬取 3 个相关网页 (默认)</option>
                      <option value="5">爬取 5 个相关网页</option>
                    </select>
                    <p className="text-[11px] text-gray-500 mt-1.5 font-medium leading-relaxed">
                      网页爬取数量越多，汇总的信息越全面，但等待时间与 API Token 消耗也会随之增加（建议设为 3）。
                    </p>
                  </div>

                  <div className="pt-2 flex justify-end">
                    <button
                      onClick={handleSaveSearchConfig}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-lg font-medium text-xs transition-colors flex items-center gap-1.5"
                    >
                      <Save size={14} />
                      保存搜索配置
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "models" && (
              <div className="space-y-6">
                {/* 1. 添加模型表单 */}
                <div className="bg-[#242424] border border-gray-700/50 rounded-xl p-6 shadow-sm">
                  <h3 className="text-sm font-semibold text-gray-200 mb-4 border-b border-gray-700/50 pb-2">
                    添加新模型
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1.5">
                        模型 ID (必填)
                      </label>
                      <input
                        type="text"
                        value={newModelId}
                        onChange={(e) => setNewModelId(e.target.value)}
                        placeholder="例如: llama3, gpt-4o"
                        className="w-full bg-[#1a1a1a] border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-200 outline-none focus:border-indigo-500 transition-all font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1.5">
                        显示名称 (可选)
                      </label>
                      <input
                        type="text"
                        value={newModelName}
                        onChange={(e) => setNewModelName(e.target.value)}
                        placeholder="例如: Ollama Llama3, OpenAI GPT-4o"
                        className="w-full bg-[#1a1a1a] border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-200 outline-none focus:border-indigo-500 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1.5">
                        模型类型
                      </label>
                      <select
                        value={newModelType}
                        onChange={(e) => setNewModelType(e.target.value)}
                        className="w-full bg-[#1a1a1a] border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-200 outline-none focus:border-indigo-500 transition-all"
                      >
                        <option value="chat">对话与 Agent 模型 (Chat / Reasoning)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1.5">
                        接口服务商 (Provider)
                      </label>
                      <select
                        value={newModelProvider}
                        onChange={(e) => {
                          const val = e.target.value;
                          setNewModelProvider(val);
                          // 仅在添加新模型时自动填充默认 URL
                          if (!editingModelId) {
                            if (val === "agnes") setNewModelBaseUrl("https://apihub.agnes-ai.com/v1");
                            else if (val === "ollama") setNewModelBaseUrl("http://localhost:11434/v1");
                            else if (val === "openai") setNewModelBaseUrl("https://api.openai.com/v1");
                          }
                        }}
                        className="w-full bg-[#1a1a1a] border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-200 outline-none focus:border-indigo-500 transition-all"
                      >
                        <option value="agnes">Agnes (默认)</option>
                        <option value="ollama">Ollama (本地)</option>
                        <option value="openai">OpenAI</option>
                        <option value="custom">Custom (自定义)</option>
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-gray-400 mb-1.5">
                        Base URL (必填)
                      </label>
                      <input
                        type="text"
                        value={newModelBaseUrl}
                        onChange={(e) => setNewModelBaseUrl(e.target.value)}
                        placeholder="例如: http://localhost:11434/v1"
                        className="w-full bg-[#1a1a1a] border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-200 outline-none focus:border-indigo-500 transition-all font-mono"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-gray-400 mb-1.5">
                        API Key (服务商为 ollama 时非必填)
                      </label>
                      <input
                        type="password"
                        value={newModelApiKey}
                        onChange={(e) => setNewModelApiKey(e.target.value)}
                        placeholder="sk-..."
                        className="w-full bg-[#1a1a1a] border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-200 outline-none focus:border-indigo-500 transition-all font-mono"
                      />
                    </div>
                  </div>
                  <div className="pt-4 flex justify-end gap-3">
                    {editingModelId && (
                      <button
                        onClick={handleCancelEdit}
                        className="bg-gray-750 hover:bg-gray-700 text-gray-200 px-5 py-2 rounded-lg font-medium text-xs transition-colors"
                      >
                        取消编辑
                      </button>
                    )}
                    <button
                      onClick={handleAddModel}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-lg font-medium text-xs transition-colors flex items-center gap-1.5"
                    >
                      <Save size={14} />
                      {editingModelId ? "更新模型配置" : "添加模型配置"}
                    </button>
                  </div>
                </div>

                {/* 2. 模型列表 */}
                <div className="bg-[#242424] border border-gray-700/50 rounded-xl p-6 shadow-sm overflow-hidden">
                  <h3 className="text-sm font-semibold text-gray-200 mb-4 border-b border-gray-700/50 pb-2">
                    已配置模型列表
                  </h3>
                  {models.length === 0 ? (
                    <div className="text-center py-6 text-xs text-gray-500">
                      暂无模型配置，请在上方添加
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-gray-700 text-gray-400 font-medium">
                            <th className="pb-2">模型 ID</th>
                            <th className="pb-2">显示名称</th>
                            <th className="pb-2">类型</th>
                            <th className="pb-2">服务商</th>
                            <th className="pb-2">Base URL</th>
                            <th className="pb-2 text-right">操作</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700 text-gray-300">
                          {models.map((m) => (
                            <tr key={m.id} className="hover:bg-gray-800/20">
                              <td className="py-3 font-mono text-gray-200">{m.model_id}</td>
                              <td className="py-3">{m.name}</td>
                              <td className="py-3">
                                <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                  Agent
                                </span>
                              </td>
                              <td className="py-3 uppercase text-[10px] text-gray-400 font-bold">
                                {m.provider}
                              </td>
                              <td className="py-3 font-mono text-[11px] text-gray-405 max-w-[200px] truncate">
                                {m.base_url}
                              </td>
                              <td className="py-3 text-right">
                                <div className="flex justify-end gap-2">
                                  <button
                                    onClick={() => handleEditModel(m)}
                                    className="text-indigo-400 hover:text-indigo-300 p-1 rounded transition-colors"
                                    title="修改此模型"
                                  >
                                    <Pencil size={14} />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteModel(m.id)}
                                    className="text-red-400 hover:text-red-300 p-1 rounded transition-colors"
                                    title="删除此模型"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default SettingsView;
