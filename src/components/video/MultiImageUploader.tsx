import React, { useRef, useState } from "react";
import { Image as ImageIcon, Upload, X, Plus } from "lucide-react";
import { useVideoStore } from "../../stores/videoStore";

// 单个图片槽位组件
const ImageSlot = ({
  index,
  image,
  onUpdate,
  onRemove,
  canRemove,
}: {
  index: number;
  image: string;
  onUpdate: (img: string) => void;
  onRemove: () => void;
  canRemove: boolean;
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = (file: File) => {
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) onUpdate(e.target.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="relative">
      {image ? (
        <div className="relative border border-gray-700 rounded-xl overflow-hidden bg-[#1a1a1a] flex items-center justify-center p-2 group h-32">
          <img
            src={image}
            alt={`Preview ${index}`}
            className="max-h-full object-contain rounded-lg"
          />
          <button
            onClick={onRemove}
            className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-red-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-all shadow-md backdrop-blur-sm">
            <X size={16} />
          </button>
        </div>
      ) : (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`h-32 border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer transition-colors ${
            isDragging
              ? "border-indigo-500 bg-indigo-500/10 text-indigo-400"
              : "border-gray-600 text-gray-400 hover:border-indigo-500 hover:bg-indigo-500/5"
          }`}>
          <ImageIcon size={24} className="mb-2 opacity-60" />
          <span className="text-[11px] font-medium text-center">
            点击或拖拽图片
          </span>
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) =>
              e.target.files?.[0] && processFile(e.target.files[0])
            }
            accept="image/*"
            className="hidden"
          />
        </div>
      )}
      {/* 空槽位时允许直接删除该槽位（如果是多图模式） */}
      {canRemove && !image && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="absolute -top-2 -right-2 p-1 bg-red-500/80 hover:bg-red-500 text-white rounded-full shadow-sm">
          <X size={12} />
        </button>
      )}
    </div>
  );
};

const MultiImageUploader = () => {
  const { mode, images, updateImage, addImage, removeImage } = useVideoStore();

  if (mode === "text") return null; // 文本生视频不需要参考图

  // 如果是单图模式，截断只显示第一张图
  const displayImages = mode === "image" ? [images[0] || ""] : images;

  return (
    <div className="space-y-3">
      <label className="flex items-center gap-1.5 text-sm font-medium text-gray-300">
        <Upload size={14} className="text-indigo-400" />
        {mode === "image" ? "参考图片" : "参考图片列表"}
      </label>

      <div className="grid grid-cols-2 gap-3">
        {displayImages.map((img, idx) => (
          <ImageSlot
            key={idx}
            index={idx}
            image={img}
            onUpdate={(newImg) => updateImage(idx, newImg)}
            onRemove={() => removeImage(idx)}
            canRemove={mode !== "image" && displayImages.length > 1}
          />
        ))}

        {(mode === "multi" || mode === "keyframe") && (
          <button
            onClick={addImage}
            className="h-32 border-2 border-dashed border-gray-700 hover:border-indigo-500 hover:text-indigo-400 rounded-xl flex flex-col items-center justify-center text-gray-500 transition-colors">
            <Plus size={24} className="mb-1" />
            <span className="text-xs font-medium">添加图片</span>
          </button>
        )}
      </div>
      <p className="text-xs text-gray-500 leading-relaxed mt-1">
        {mode === "multi" && "提供多张参考图，视频将融合这些图像的内容。"}
        {mode === "keyframe" &&
          "第一张为起始帧，最后一张为结束帧，生成帧间平滑过渡。"}
      </p>
    </div>
  );
};

export default MultiImageUploader;
