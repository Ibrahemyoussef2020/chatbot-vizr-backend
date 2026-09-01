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
        const { PDFParse } = await import("pdf-parse");
        const parser = new PDFParse({ data: file.buffer });
        try {
            const result = await parser.getText();
            return { text: result.text, metadata: { pages: result.total } };
        } finally {
            await parser.destroy();
        }
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
    static kindFor(file: Express.Multer.File): KnowledgeSourceKind {
        const extension = extname(file.originalname).toLowerCase();
        if (file.mimetype === "application/pdf" || extension === ".pdf") return "pdf";
        if (file.mimetype.startsWith("audio/")) return "audio";
        if (file.mimetype.startsWith("video/")) return "video";
        if ([".xls", ".xlsx", ".csv"].includes(extension)) return "excel";
        if (file.mimetype.startsWith("text/") || [".txt", ".md", ".json", ".xml"].includes(extension)) return "text";
        throw unprocessableEntityError(`Unsupported knowledge file type: ${file.originalname}`);
    }

    static create(file: Express.Multer.File): KnowledgeFileProcessor {
        return processors[this.kindFor(file)];
    }
}
