import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  VerticalAlignTable,
  WidthType,
} from "docx";
import type {
  ActionItemPriority,
  TranscriptSegment,
  VietnameseMeetingNotes,
  VietnameseMeetingTranscript,
} from "../gemini";
import { formatExportTimestamp } from "./markdown-exporter";
import type { ExportOptions, ExportResult } from "./types";

const fallback = "Chưa xác định";
const docxMimeType =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

type ExportableNotes = Partial<
  Omit<VietnameseMeetingNotes, "meetingOverview" | "transcript">
> & {
  meetingOverview?: Partial<VietnameseMeetingNotes["meetingOverview"]>;
  transcript?: Partial<VietnameseMeetingTranscript>;
};

export async function exportMeetingNotesDocx(
  notes: ExportableNotes,
  options: ExportOptions = {},
): Promise<ExportResult> {
  try {
    const doc = new Document({
      creator: "Vietnamese Meeting Notes Generator",
      title: "Meeting Notes",
      styles: {
        paragraphStyles: [
          {
            id: "Title",
            name: "Title",
            basedOn: "Normal",
            next: "Normal",
            quickFormat: true,
            run: {
              size: 40,
              bold: true,
              color: "111827",
              font: "Arial",
            },
            paragraph: {
              spacing: { after: 360 },
            },
          },
          {
            id: "Heading1",
            name: "Heading 1",
            basedOn: "Normal",
            next: "Normal",
            quickFormat: true,
            run: {
              size: 28,
              bold: true,
              color: "111827",
              font: "Arial",
            },
            paragraph: {
              spacing: { before: 260, after: 160 },
            },
          },
        ],
      },
      sections: [
        {
          properties: {
            page: {
              margin: {
                top: 1440,
                right: 1440,
                bottom: 1440,
                left: 1440,
              },
            },
          },
          children: buildDocumentChildren(notes),
        },
      ],
    });

    return {
      filename: `meeting-notes-${formatExportTimestamp(options.now ?? new Date())}.docx`,
      mimeType: docxMimeType,
      content: await Packer.toBuffer(doc),
      format: "docx",
    };
  } catch (error) {
    throw new Error(
      error instanceof Error ? error.message : "DOCX export failed.",
    );
  }
}

function buildDocumentChildren(notes: ExportableNotes) {
  return [
    new Paragraph({
      text: "Meeting Notes",
      heading: HeadingLevel.TITLE,
    }),
    sectionHeading("1. Tóm tắt điều hành"),
    ...buildBulletList(notes.executiveSummary),
    sectionHeading("2. Thông tin cuộc họp"),
    ...buildMeetingOverview(notes),
    sectionHeading("3. Nội dung chính"),
    ...buildDiscussionPoints(notes.keyDiscussionPoints),
    sectionHeading("4. Quyết định"),
    ...buildBulletList(notes.decisions),
    sectionHeading("5. Action Items"),
    buildActionItemsTable(notes.actionItems),
    sectionHeading("6. Rủi ro / Blockers"),
    ...buildBulletList(notes.risksAndBlockers),
    sectionHeading("7. Câu hỏi còn mở"),
    ...buildBulletList(notes.openQuestions),
    sectionHeading("8. Transcript có timestamp"),
    ...buildTranscriptParagraphs(notes.transcript),
  ];
}

function sectionHeading(text: string) {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_1,
  });
}

export function safeText(value: unknown) {
  return typeof value === "string" && value.trim().length > 0
    ? value
    : fallback;
}

export function safeList(items: unknown) {
  if (!Array.isArray(items) || items.length === 0) {
    return [fallback];
  }

  return items.map((item) => safeText(item));
}

export function buildBulletList(items: unknown) {
  return safeList(items).map(
    (item) =>
      new Paragraph({
        text: item,
        bullet: { level: 0 },
        spacing: { after: 80 },
      }),
  );
}

function buildMeetingOverview(notes: ExportableNotes) {
  const overview = notes.meetingOverview || {};

  return buildBulletList([
    `Ngôn ngữ: ${safeText(overview.language)}`,
    `Thời lượng: ${safeText(overview.duration)}`,
    `Số người nói: ${
      typeof overview.speakerCount === "number"
        ? String(overview.speakerCount)
        : fallback
    }`,
    `Chủ đề chính: ${safeText(overview.mainTopic)}`,
  ]);
}

function buildDiscussionPoints(
  points: ExportableNotes["keyDiscussionPoints"],
) {
  if (!Array.isArray(points) || points.length === 0) {
    return [
      new Paragraph({
        text: fallback,
        spacing: { after: 80 },
      }),
    ];
  }

  return points.flatMap((point) => [
    new Paragraph({
      children: [
        new TextRun({
          text: safeText(point?.title),
          bold: true,
        }),
      ],
      spacing: { before: 120, after: 80 },
    }),
    ...buildBulletList(point?.details),
  ]);
}

export function buildActionItemsTable(
  items: ExportableNotes["actionItems"],
) {
  const rows = [
    new TableRow({
      tableHeader: true,
      children: [
        headerCell("Việc cần làm"),
        headerCell("Người phụ trách"),
        headerCell("Deadline"),
        headerCell("Ưu tiên"),
        headerCell("Ghi chú"),
      ],
    }),
    ...normalizeActionItems(items).map(
      (item) =>
        new TableRow({
          children: [
            bodyCell(item.task),
            bodyCell(item.owner),
            bodyCell(item.deadline),
            bodyCell(item.priority),
            bodyCell(item.notes),
          ],
        }),
    ),
  ];

  return new Table({
    rows,
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: [3000, 1800, 1600, 1200, 2600],
    layout: TableLayoutType.FIXED,
    borders: {
      top: tableBorder(),
      bottom: tableBorder(),
      left: tableBorder(),
      right: tableBorder(),
      insideHorizontal: tableBorder("D9E2EC"),
      insideVertical: tableBorder("D9E2EC"),
    },
  });
}

function normalizeActionItems(items: ExportableNotes["actionItems"]) {
  if (!Array.isArray(items) || items.length === 0) {
    return [
      {
        task: fallback,
        owner: fallback,
        deadline: fallback,
        priority: fallback as ActionItemPriority,
        notes: fallback,
      },
    ];
  }

  return items.map((item) => ({
    task: safeText(item?.task),
    owner: safeText(item?.owner),
    deadline: safeText(item?.deadline),
    priority: safeText(item?.priority),
    notes: safeText(item?.notes),
  }));
}

function headerCell(text: string) {
  return new TableCell({
    shading: { fill: "EAF2FF" },
    margins: cellMargins(),
    verticalAlign: VerticalAlignTable.CENTER,
    children: [
      new Paragraph({
        alignment: AlignmentType.LEFT,
        children: [
          new TextRun({
            text,
            bold: true,
            color: "111827",
          }),
        ],
      }),
    ],
  });
}

function bodyCell(text: unknown) {
  return new TableCell({
    margins: cellMargins(),
    verticalAlign: VerticalAlignTable.CENTER,
    children: [
      new Paragraph({
        children: [new TextRun(safeText(text))],
      }),
    ],
  });
}

function tableBorder(color = "AEBCCD") {
  return {
    style: BorderStyle.SINGLE,
    size: 1,
    color,
  };
}

function cellMargins() {
  return {
    top: 120,
    bottom: 120,
    left: 120,
    right: 120,
  };
}

export function buildTranscriptParagraphs(
  transcript: ExportableNotes["transcript"],
) {
  const segments = Array.isArray(transcript?.segments)
    ? transcript.segments
    : [];

  if (segments.length === 0) {
    return [
      new Paragraph({
        text: fallback,
        spacing: { after: 80 },
      }),
    ];
  }

  return segments.map((segment) => buildTranscriptParagraph(segment));
}

function buildTranscriptParagraph(segment: Partial<TranscriptSegment>) {
  const end = segment.end ? ` - ${segment.end}` : "";

  return new Paragraph({
    children: [
      new TextRun({
        text: `[${safeText(segment.start)}${end}] ${safeText(segment.speaker)}: `,
        bold: true,
      }),
      new TextRun(safeText(segment.text)),
    ],
    spacing: { after: 100 },
  });
}
