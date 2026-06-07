import React, { useState, useRef } from "react";
import { Image as ImageIcon, Upload, X } from "lucide-react";
import { useImageStore } from "../stores/imageStore";

const ImageUploader = () => {
  const { referenceImage, setReferenceImage } = useImageStore();
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const processFile = (file: File) => {
    if (!file.type.startsWith("image/")) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        setReferenceImage(e.target.result as string);
      }
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  return (
    <div className="space-y-2">
      <label className="flex items-center gap-1.5 text-sm font-medium text-gray-300">
        <Upload size={14} className="text-indigo-400" />
        参考图片
      </label>

      {referenceImage ? (
        <div className="relative border border-gray-700 rounded-xl overflow-hidden bg-[#1a1a1a] flex items-center justify-center p-2 group">
          <img
            src={referenceImage}
            alt="Reference Preview"
            className="max-h-32 object-contain rounded-lg"
          />
          <button
            onClick={() => setReferenceImage(null)}
            className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-red-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-all shadow-md backdrop-blur-md"
            title="移除参考图">
            <X size={16} />
          </button>
        </div>
      ) : (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition-colors ${
            isDragging
              ? "border-indigo-500 bg-indigo-500/10 text-indigo-400"
              : "border-gray-600 text-gray-400 hover:border-indigo-500 hover:bg-indigo-500/5"
          }`}>
          <ImageIcon size={28} className="mb-2 opacity-60" />
          <span className="text-xs font-medium">点击选择或拖拽图片至此</span>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleChange}
            accept="image/*"
            className="hidden"
          />
        </div>
      )}
    </div>
  );
};

export default ImageUploader;
