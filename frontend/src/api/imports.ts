import { request } from "./client";
import type { LegacyImportCommit, LegacyImportPreview } from "./types";

const form = (file: File) => { const data = new FormData(); data.append("file", file); return data; };
export const previewLegacyImport = (file: File) => request<LegacyImportPreview>("/api/imports/legacy-ratings/preview", { method: "POST", body: form(file) });
export const commitLegacyImport = (file: File, selectedRows: number[]) => { const data = form(file); data.append("selected_rows", JSON.stringify(selectedRows)); return request<LegacyImportCommit>("/api/imports/legacy-ratings/commit", { method: "POST", body: data }); };
