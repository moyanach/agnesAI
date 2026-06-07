import { create } from "zustand";

export type ImageMode = "txt2img" | "img2img";
export type AspectRatio = "1:1" | "3:4" | "4:3" | "9:16" | "16:9" | "custom";

const ASPECT_RATIO_MAP: Record<
  Exclude<AspectRatio, "custom">,
  { width: number; height: number }
> = {
  "1:1": { width: 1024, height: 1024 },
  "3:4": { width: 768, height: 1024 },
  "4:3": { width: 1024, height: 768 },
  "9:16": { width: 720, height: 1280 },
  "16:9": { width: 1280, height: 720 },
};

interface ImageState {
  // Form parameters
  mode: ImageMode;
  prompt: string;
  referenceImage: string | null;
  width: number;
  height: number;
  aspectRatio: AspectRatio;

  // Actions
  setMode: (mode: ImageMode) => void;
  setPrompt: (prompt: string) => void;
  setReferenceImage: (image: string | null) => void;
  setWidth: (width: number) => void;
  setHeight: (height: number) => void;
  setAspectRatio: (ratio: AspectRatio) => void;
}

export const useImageStore = create<ImageState>((set) => ({
  mode: "txt2img",
  prompt: "",
  referenceImage: null,
  width: 1024,
  height: 1024,
  aspectRatio: "1:1",

  setMode: (mode) => set({ mode }),
  setPrompt: (prompt) => set({ prompt }),
  setReferenceImage: (referenceImage) => set({ referenceImage }),
  setWidth: (width) => set({ width, aspectRatio: "custom" }),
  setHeight: (height) => set({ height, aspectRatio: "custom" }),
  setAspectRatio: (ratio) => {
    if (ratio !== "custom") {
      const dimensions = ASPECT_RATIO_MAP[ratio];
      set({
        aspectRatio: ratio,
        width: dimensions.width,
        height: dimensions.height,
      });
    }
  },
}));
