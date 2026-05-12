export const modelOptions = [
  {
    label: "Gemini 2.5 Flash",
    value: "Gemini 2.5 Flash",
    modelId: "gemini-2.5-flash",
  },
  {
    label: "Gemini 3 Flash Preview",
    value: "Gemini 3 Flash Preview",
    modelId: "gemini-3-flash-preview",
  },
  {
    label: "Gemini 3.1 Flash Lite Preview",
    value: "Gemini 3.1 Flash Lite Preview",
    // Keep this constant easy to update. As of this implementation, Google
    // public docs clearly list 2.5 Flash and 3 Flash Preview; 3.1 Flash Lite
    // Preview is kept because the product spec requires it.
    modelId: "gemini-3.1-flash-lite-preview",
  },
] as const;

export const defaultModelLabel = "Gemini 3 Flash Preview";

export type GeminiModelLabel = (typeof modelOptions)[number]["label"];

export function getGeminiModelId(modelLabel: string) {
  const model = modelOptions.find((option) => option.label === modelLabel);

  if (!model) {
    throw new Error("Unsupported Gemini model.");
  }

  return model.modelId;
}
