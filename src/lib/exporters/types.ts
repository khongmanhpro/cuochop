export type ExportFormat = "markdown" | "docx";

export type ExportResult = {
  filename: string;
  mimeType: string;
  content: string | Buffer;
  format: ExportFormat;
};

export type ExportOptions = {
  now?: Date;
};
