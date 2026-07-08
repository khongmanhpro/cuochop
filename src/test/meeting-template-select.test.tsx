// @vitest-environment happy-dom

/**
 * Component tests for MeetingTemplateSelect.
 *
 * Verifies:
 * - Renders transcription + notes model selects
 * - Renders all meeting template buttons
 * - Highlights selected template
 * - Calls setTemplate when a template is clicked
 * - Calls setTranscriptionModel when transcription model changes
 * - Calls setNotesModel when notes model changes
 */

import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MeetingTemplateSelect } from "@/components/meeting-template-select";
import { MEETING_TEMPLATES } from "@/lib/meeting-templates";
import { modelOptions } from "@/lib/meeting-notes-mock";

afterEach(() => cleanup());

describe("MeetingTemplateSelect", () => {
  function renderSelect(overrides: Partial<{
    template: string;
    setTemplate: (v: string) => void;
    transcriptionModel: string;
    setTranscriptionModel: (v: string) => void;
    notesModel: string;
    setNotesModel: (v: string) => void;
  }> = {}) {
    const props = {
      template: "default",
      setTemplate: vi.fn(),
      transcriptionModel: modelOptions[0].value,
      setTranscriptionModel: vi.fn(),
      notesModel: modelOptions[0].value,
      setNotesModel: vi.fn(),
      ...overrides,
    };
    return { props, ...render(<MeetingTemplateSelect {...props} />) };
  }

  test("renders both model select labels", () => {
    renderSelect();
    expect(screen.getByText("Transcription Model")).toBeInTheDocument();
    expect(screen.getByText("Notes Generation Model")).toBeInTheDocument();
  });

  test("renders all meeting template buttons with labels", () => {
    renderSelect();
    for (const t of MEETING_TEMPLATES) {
      expect(screen.getByText(t.label)).toBeInTheDocument();
    }
  });

  test("highlights the selected template", () => {
    const firstTemplate = MEETING_TEMPLATES[0];
    renderSelect({ template: firstTemplate.id });

    const button = screen.getByText(firstTemplate.label).closest("button")!;
    expect(button.className).toContain("border-ink");
    expect(button.className).toContain("bg-brand-blue-200/40");
  });

  test("does not highlight unselected templates", () => {
    const firstTemplate = MEETING_TEMPLATES[0];
    const secondTemplate = MEETING_TEMPLATES[1];
    renderSelect({ template: firstTemplate.id });

    const button = screen.getByText(secondTemplate.label).closest("button")!;
    expect(button.className).toContain("border-hairline");
    expect(button.className).not.toContain("border-ink");
  });

  test("calls setTemplate when a template button is clicked", () => {
    const setTemplate = vi.fn();
    const secondTemplate = MEETING_TEMPLATES[1];
    renderSelect({ setTemplate });

    fireEvent.click(screen.getByText(secondTemplate.label));
    expect(setTemplate).toHaveBeenCalledWith(secondTemplate.id);
  });

  test("renders all model options in transcription select", () => {
    renderSelect();
    const transcriptionSelect = screen.getByLabelText(
      "Transcription Model",
    ) as HTMLSelectElement;

    const optionValues = Array.from(transcriptionSelect.options).map(
      (o) => o.value,
    );
    expect(optionValues).toEqual(modelOptions.map((m) => m.value));
  });

  test("renders all model options in notes select", () => {
    renderSelect();
    const notesSelect = screen.getByLabelText(
      "Notes Generation Model",
    ) as HTMLSelectElement;

    const optionValues = Array.from(notesSelect.options).map((o) => o.value);
    expect(optionValues).toEqual(modelOptions.map((m) => m.value));
  });

  test("calls setTranscriptionModel when transcription select changes", () => {
    const setTranscriptionModel = vi.fn();
    renderSelect({ setTranscriptionModel });

    const select = screen.getByLabelText("Transcription Model") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: modelOptions[1].value } });

    expect(setTranscriptionModel).toHaveBeenCalledWith(modelOptions[1].value);
  });

  test("calls setNotesModel when notes select changes", () => {
    const setNotesModel = vi.fn();
    renderSelect({ setNotesModel });

    const select = screen.getByLabelText("Notes Generation Model") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: modelOptions[1].value } });

    expect(setNotesModel).toHaveBeenCalledWith(modelOptions[1].value);
  });
});
