"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { assertAccessibleMeetingNote } from "@/lib/meeting-access";
import {
  buildUpdatedMeetingPayload,
  linesFromTextarea,
} from "@/lib/meeting-notes-edit";
import { buildSpeakerRenamePayload } from "@/lib/meeting-notes-speakers";
import { applyTagsToNotesJson, parseTagsInput } from "@/lib/meeting-tags";
import { getSession } from "@/lib/session";

export type MeetingActionState = {
  error?: string;
  success?: string;
};

export async function renameMeetingNote(
  _prev: MeetingActionState,
  formData: FormData,
): Promise<MeetingActionState> {
  const user = await getSession();
  if (!user) {
    return { error: "Bạn cần đăng nhập." };
  }

  const meetingId = String(formData.get("meetingId") || "").trim();
  const title = String(formData.get("title") || "").trim();

  if (!meetingId) {
    return { error: "Thiếu mã cuộc họp." };
  }

  if (!title) {
    return { error: "Tên cuộc họp không được để trống." };
  }

  if (title.length > 200) {
    return { error: "Tên cuộc họp tối đa 200 ký tự." };
  }

  const existing = await assertAccessibleMeetingNote(user.id, meetingId);
  if (!existing) {
    return { error: "Không tìm thấy cuộc họp hoặc bạn không có quyền." };
  }

  await prisma.meetingNote.update({
    where: { id: meetingId },
    data: { title },
  });

  revalidatePath("/history");
  revalidatePath(`/history/${meetingId}`);
  revalidatePath("/app");
  revalidatePath("/actions");

  return { success: "Đã đổi tên cuộc họp." };
}

export async function deleteMeetingNote(formData: FormData): Promise<void> {
  const user = await getSession();
  if (!user) {
    throw new Error("Bạn cần đăng nhập.");
  }

  const meetingId = String(formData.get("meetingId") || "").trim();
  if (!meetingId) {
    throw new Error("Thiếu mã cuộc họp.");
  }

  const existing = await assertAccessibleMeetingNote(user.id, meetingId);
  if (!existing) {
    throw new Error("Không tìm thấy cuộc họp hoặc bạn không có quyền.");
  }

  // Cascade deletes action items + decisions via Prisma schema
  await prisma.meetingNote.delete({
    where: { id: meetingId },
  });

  revalidatePath("/history");
  revalidatePath("/app");
  revalidatePath("/actions");
  redirect("/history");
}

export async function updateMeetingNotesContent(
  _prev: MeetingActionState,
  formData: FormData,
): Promise<MeetingActionState> {
  const user = await getSession();
  if (!user) {
    return { error: "Bạn cần đăng nhập." };
  }

  const meetingId = String(formData.get("meetingId") || "").trim();
  if (!meetingId) {
    return { error: "Thiếu mã cuộc họp." };
  }

  const existing = await assertAccessibleMeetingNote(user.id, meetingId);
  if (!existing) {
    return { error: "Không tìm thấy cuộc họp hoặc bạn không có quyền." };
  }

  const edits = {
    mainTopic: String(formData.get("mainTopic") || ""),
    executiveSummary: linesFromTextarea(
      String(formData.get("executiveSummary") || ""),
    ),
    decisions: linesFromTextarea(String(formData.get("decisions") || "")),
    risksAndBlockers: linesFromTextarea(
      String(formData.get("risksAndBlockers") || ""),
    ),
    openQuestions: linesFromTextarea(
      String(formData.get("openQuestions") || ""),
    ),
  };

  let payload: ReturnType<typeof buildUpdatedMeetingPayload>;
  try {
    payload = buildUpdatedMeetingPayload(existing.notesJson, edits);
  } catch {
    return {
      error: "Không đọc được notes hiện tại. Không thể lưu chỉnh sửa.",
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.meetingNote.update({
      where: { id: meetingId },
      data: {
        notesJson: payload.notesJson,
        markdown: payload.markdown,
      },
    });

    // Keep Decision Log in sync with edited decision lines
    await tx.decision.deleteMany({ where: { meetingNoteId: meetingId } });
    if (payload.notes.decisions.length > 0) {
      await tx.decision.createMany({
        data: payload.notes.decisions.map((content) => ({
          meetingNoteId: meetingId,
          userId: existing.userId,
          organizationId: existing.organizationId,
          content,
        })),
      });
    }
  });

  revalidatePath("/history");
  revalidatePath(`/history/${meetingId}`);
  revalidatePath("/app");
  revalidatePath("/actions");

  return { success: "Đã lưu chỉnh sửa notes." };
}

export async function renameMeetingSpeakers(
  _prev: MeetingActionState,
  formData: FormData,
): Promise<MeetingActionState> {
  const user = await getSession();
  if (!user) return { error: "Bạn cần đăng nhập." };

  const meetingId = String(formData.get("meetingId") || "").trim();
  if (!meetingId) return { error: "Thiếu mã cuộc họp." };

  const existing = await assertAccessibleMeetingNote(user.id, meetingId);
  if (!existing) {
    return { error: "Không tìm thấy cuộc họp hoặc bạn không có quyền." };
  }

  const renames: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("speaker:") || typeof value !== "string") continue;
    const from = key.slice("speaker:".length);
    renames[from] = value;
  }

  let payload: ReturnType<typeof buildSpeakerRenamePayload>;
  try {
    payload = buildSpeakerRenamePayload(existing.notesJson, renames);
  } catch {
    return { error: "Không đọc được notes để đổi tên speaker." };
  }

  await prisma.meetingNote.update({
    where: { id: meetingId },
    data: {
      notesJson: payload.notesJson,
      markdown: payload.markdown,
    },
  });

  revalidatePath(`/history/${meetingId}`);
  revalidatePath("/history");
  return { success: "Đã cập nhật tên người nói." };
}

export async function updateMeetingTags(
  _prev: MeetingActionState,
  formData: FormData,
): Promise<MeetingActionState> {
  const user = await getSession();
  if (!user) return { error: "Bạn cần đăng nhập." };

  const meetingId = String(formData.get("meetingId") || "").trim();
  if (!meetingId) return { error: "Thiếu mã cuộc họp." };

  const existing = await assertAccessibleMeetingNote(user.id, meetingId);
  if (!existing) {
    return { error: "Không tìm thấy cuộc họp hoặc bạn không có quyền." };
  }

  const tags = parseTagsInput(String(formData.get("tags") || ""));
  let notesJson: string;
  try {
    notesJson = applyTagsToNotesJson(existing.notesJson, tags);
  } catch {
    return { error: "Không lưu được thẻ (tags)." };
  }

  await prisma.meetingNote.update({
    where: { id: meetingId },
    data: { notesJson },
  });

  revalidatePath(`/history/${meetingId}`);
  revalidatePath("/history");
  return { success: "Đã lưu thẻ." };
}
