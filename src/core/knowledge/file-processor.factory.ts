import { extname } from "node:path";
import { unprocessableEntityError } from "../shared/errors/HttpError.js";

export type KnowledgeSourceKind = "pdf" | "audio" | "video" | "excel" | "text";
export interface ProcessedKnowledgeFile { text: string; metadata?: Record<string, unknown>; }
export interface KnowledgeFileProcessor {
    readonly kind: KnowledgeSourceKind;
    process(file: Express.Multer.File): Promise<ProcessedKnowledgeFile>;
}

class TextProcessor implements KnowledgeFileProcessor {
    readonly kind = "text" as const;
    async process(file: Express.Multer.File) {
        return { text: file.buffer.toString("utf8"), metadata: { encoding: "utf8" } };
    }
}

class PdfProcessor implements KnowledgeFileProcessor {
    readonly kind = "pdf" as const;
    async process(file: Express.Multer.File) {
        const { default: parsePdf } = await import("pdf-parse");
        const result = await parsePdf(file.buffer);
        return { text: result.text, metadata: { pages: result.numpages } };
    }
}

class ExcelProcessor implements KnowledgeFileProcessor {
    readonly kind = "excel" as const;
    async process(file: Express.Multer.File) {
        const XLSX = await import("xlsx");
        const workbook = XLSX.read(file.buffer, { type: "buffer" });
        const text = workbook.SheetNames.map((name) => {
            const csv = XLSX.utils.sheet_to_csv(workbook.Sheets[name]);
            return `# Sheet: ${name}\n${csv}`;
        }).join("\n\n");
        return { text, metadata: { sheets: workbook.SheetNames } };
    }
}

class MediaProcessor implements KnowledgeFileProcessor {
    constructor(readonly kind: "audio" | "video") {}
    async process(file: Express.Multer.File) {
        const apiKey = process.env.OPENAI_API_KEY?.trim() || process.env.OPEN_AI_SECRET_KEY?.trim();
        if (!apiKey) throw unprocessableEntityError("An OpenAI API key is required to transcribe audio and video.");
        const form = new FormData();
        form.append("model", process.env.OPENAI_TRANSCRIPTION_MODEL || "whisper-1");
        form.append("file", new Blob([Uint8Array.from(file.buffer)], { type: file.mimetype }), file.originalname);
        const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
            method: "POST", headers: { Authorization: `Bearer ${apiKey}` }, body: form,
        });
        const result: any = await response.json().catch(() => ({}));
        if (!response.ok) throw unprocessableEntityError(result?.error?.message || "Media transcription failed.");
        return { text: result.text || "", metadata: { transcriptionModel: process.env.OPENAI_TRANSCRIPTION_MODEL || "whisper-1" } };
    }
}

const processors = {
    pdf: new PdfProcessor(), text: new TextProcessor(), excel: new ExcelProcessor(),
    audio: new MediaProcessor("audio"), video: new MediaProcessor("video"),
};

export class KnowledgeFileProcessorFactory {
    static kindForDescriptor(name: string, mimeType: string): KnowledgeSourceKind {
        const extension = extname(name).toLowerCase();
        if (mimeType === "application/pdf" || extension === ".pdf") return "pdf";
        if (mimeType.startsWith("audio/")) return "audio";
        if (mimeType.startsWith("video/")) return "video";
        if ([".xls", ".xlsx", ".csv"].includes(extension)) return "excel";
        if (mimeType.startsWith("text/") || [".txt", ".md", ".json", ".xml"].includes(extension)) return "text";
        throw unprocessableEntityError(`Unsupported knowledge file type: ${name}`);
    }

    static kindFor(file: Express.Multer.File): KnowledgeSourceKind {
        return this.kindForDescriptor(file.originalname, file.mimetype);
    }

    static create(file: Express.Multer.File): KnowledgeFileProcessor {
        return processors[this.kindFor(file)];
    }
}
