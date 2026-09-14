export type AlbumTitleSize = "normal" | "long" | "very-long";

export function albumTitleSize(title: string): AlbumTitleSize {
  if (title.length > 70) return "very-long";
  if (title.length > 35) return "long";
  return "normal";
}
