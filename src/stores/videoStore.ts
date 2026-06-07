import { create } from "zustand";

export type VideoMode = "text" | "image" | "multi" | "keyframe";

interface VideoState {
  mode: VideoMode;
  prompt: string;
  images: string[];
  width: number;
  height: number;
  frameRate: number;
  numFrames: number;

  setMode: (mode: VideoMode) => void;
  setPrompt: (prompt: string) => void;
  updateImage: (index: number, image: string) => void;
  addImage: () => void;
  removeImage: (index: number) => void;
}

export const useVideoStore = create<VideoState>((set) => ({
  mode: "text",
  prompt: "",
  images: [""], // 默认至少留一个空槽位
  width: 1152,
  height: 768,
  frameRate: 24,
  numFrames: 121,

  setMode: (mode) =>
    set((state) => ({
      mode,
      images: state.images.length === 0 ? [""] : state.images,
    })),
  setPrompt: (prompt) => set({ prompt }),
  updateImage: (index, image) =>
    set((state) => {
      const newImages = [...state.images];
      newImages[index] = image;
      return { images: newImages };
    }),
  addImage: () => set((state) => ({ images: [...state.images, ""] })),
  removeImage: (index) =>
    set((state) => {
      const newImages = state.images.filter((_, i) => i !== index);
      return { images: newImages.length ? newImages : [""] };
    }),
}));
