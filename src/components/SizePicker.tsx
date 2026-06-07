import React from "react";
import { useImageStore } from "../../stores/imageStore";

const PRESETS = [
  { id: "1:1", label: "1:1", w: 16, h: 16 },
  { id: "3:4", label: "3:4", w: 13.5, h: 18 },
  { id: "4:3", label: "4:3", w: 18, h: 13.5 },
  { id: "9:16", label: "9:16", w: 11.25, h: 20 },
  { id: "16:9", label: "16:9", w: 20, h: 11.25 },
] as const;

const SizePicker = () => {
  const { width, height, aspectRatio, setWidth, setHeight, setAspectRatio } =
    useImageStore();

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-400 mb-2">
          常用尺寸
        </label>
        <div className="grid grid-cols-5 gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => setAspectRatio(p.id)}
              className={`flex flex-col items-center gap-1.5 p-2 rounded-lg border transition-colors ${
                aspectRatio === p.id
                  ? "bg-indigo-500/20 border-indigo-500 text-indigo-300"
                  : "border-gray-700 bg-[#2a2a2a] hover:border-gray-500 text-gray-400"
              }`}>
              <div className="h-7 flex items-center justify-center">
                <div
                  style={{ width: p.w, height: p.h }}
                  className="border-2 border-current rounded-sm"
                />
              </div>
              <span className="text-xs font-mono">{p.label}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1.5">
            宽度
          </label>
          <input
            type="number"
            value={width}
            onChange={(e) => setWidth(parseInt(e.target.value, 10) || 0)}
            className="w-full bg-[#1a1a1a] border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 outline-none focus:border-indigo-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1.5">
            高度
          </label>
          <input
            type="number"
            value={height}
            onChange={(e) => setHeight(parseInt(e.target.value, 10) || 0)}
            className="w-full bg-[#1a1a1a] border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 outline-none focus:border-indigo-500"
          />
        </div>
      </div>
    </div>
  );
};

export default SizePicker;
