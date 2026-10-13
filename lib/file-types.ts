// Extension groupings shared by the Files API (type filter) and the Files screen (icons, previews)
export const FILE_TYPES = {
  image: ["png", "jpg", "jpeg", "gif", "webp", "heic", "svg"],
  doc: ["md", "txt", "pdf", "csv", "doc", "docx", "rtf", "pages", "xlsx", "xls", "numbers", "key", "pptx"],
  code: ["ts", "tsx", "js", "jsx", "mjs", "cjs", "json", "py", "sh", "html", "css", "yml", "yaml", "toml", "xml", "sql"],
  media: ["mp4", "mov", "m4v", "webm", "mp3", "m4a", "wav", "aac"],
  archive: ["zip", "gz", "tgz", "tar", "rar", "7z", "dmg", "pkg"],
} as const;

export type FileType = keyof typeof FILE_TYPES;

export function fileType(ext: string): FileType | null {
  for (const [type, exts] of Object.entries(FILE_TYPES)) {
    if ((exts as readonly string[]).includes(ext)) return type as FileType;
  }
  return null;
}

// Extensions the screen can show inline, and how
export const PREVIEW_IMAGE = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg"]);
export const PREVIEW_TEXT = new Set(["md", "txt", "csv", "log", "ts", "tsx", "js", "jsx", "mjs", "cjs", "json", "py", "sh", "html", "css", "yml", "yaml", "toml", "xml", "sql"]);
export const PREVIEW_TEXT_MAX = 512 * 1024;
