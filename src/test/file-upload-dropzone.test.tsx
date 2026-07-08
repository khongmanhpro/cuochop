// @vitest-environment happy-dom

/**
 * Component tests for FileUploadDropzone.
 *
 * Verifies:
 * - Renders file picker with drag&drop instructions
 * - Shows selected file name
 * - Shows "No file selected" when no file
 * - Calls chooseFile when file is dropped
 * - Calls chooseFile when file is picked via input
 * - Applies dragging styles when isDragging=true
 */

import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { FileUploadDropzone } from "@/components/file-upload-dropzone";

afterEach(() => cleanup());

describe("FileUploadDropzone", () => {
  test("renders drag&drop instructions and file picker button", () => {
    render(
      <FileUploadDropzone
        selectedFile={null}
        isDragging={false}
        setIsDragging={() => {}}
        chooseFile={() => {}}
      />,
    );

    expect(
      screen.getByText("Drag and drop your recording here"),
    ).toBeInTheDocument();
    expect(screen.getByText("Choose File")).toBeInTheDocument();
    expect(
      screen.getByText("No file selected"),
    ).toBeInTheDocument();
  });

  test("shows selected file name when file is provided", () => {
    const file = new File(["audio"], "meeting.mp3", { type: "audio/mpeg" });
    render(
      <FileUploadDropzone
        selectedFile={file}
        isDragging={false}
        setIsDragging={() => {}}
        chooseFile={() => {}}
      />,
    );

    expect(screen.getByText("meeting.mp3")).toBeInTheDocument();
    expect(screen.queryByText("No file selected")).not.toBeInTheDocument();
  });

  test("calls chooseFile when a file is dropped", () => {
    const chooseFile = vi.fn();
    render(
      <FileUploadDropzone
        selectedFile={null}
        isDragging={false}
        setIsDragging={() => {}}
        chooseFile={chooseFile}
      />,
    );

    const dropzone = screen.getByText("Drag and drop your recording here").closest("label")!;
    const file = new File(["audio"], "dropped.wav", { type: "audio/wav" });

    fireEvent.drop(dropzone, {
      dataTransfer: { files: [file] },
    });

    expect(chooseFile).toHaveBeenCalledWith(file);
  });

  test("calls chooseFile when a file is selected via input", () => {
    const chooseFile = vi.fn();
    render(
      <FileUploadDropzone
        selectedFile={null}
        isDragging={false}
        setIsDragging={() => {}}
        chooseFile={chooseFile}
      />,
    );

    const input = screen.getByLabelText(/Drag and drop your recording here/) as HTMLInputElement;
    const file = new File(["audio"], "picked.m4a", { type: "audio/mp4" });

    fireEvent.change(input, { target: { files: [file] } });

    expect(chooseFile).toHaveBeenCalledWith(file);
  });

  test("applies dragging styles when isDragging is true", () => {
    render(
      <FileUploadDropzone
        selectedFile={null}
        isDragging={true}
        setIsDragging={() => {}}
        chooseFile={() => {}}
      />,
    );

    const dropzone = screen.getByText("Drag and drop your recording here").closest("label")!;
    expect(dropzone.className).toContain("border-brand-blue-deep");
    expect(dropzone.className).toContain("bg-brand-blue-200/40");
  });

  test("applies default styles when isDragging is false", () => {
    render(
      <FileUploadDropzone
        selectedFile={null}
        isDragging={false}
        setIsDragging={() => {}}
        chooseFile={() => {}}
      />,
    );

    const dropzone = screen.getByText("Drag and drop your recording here").closest("label")!;
    expect(dropzone.className).toContain("border-stone");
    expect(dropzone.className).toContain("bg-surface");
  });

  test("calls setIsDragging(true) on dragOver", () => {
    const setIsDragging = vi.fn();
    render(
      <FileUploadDropzone
        selectedFile={null}
        isDragging={false}
        setIsDragging={setIsDragging}
        chooseFile={() => {}}
      />,
    );

    const dropzone = screen.getByText("Drag and drop your recording here").closest("label")!;
    fireEvent.dragOver(dropzone);
    expect(setIsDragging).toHaveBeenCalledWith(true);
  });

  test("calls setIsDragging(false) on dragLeave", () => {
    const setIsDragging = vi.fn();
    render(
      <FileUploadDropzone
        selectedFile={null}
        isDragging={true}
        setIsDragging={setIsDragging}
        chooseFile={() => {}}
      />,
    );

    const dropzone = screen.getByText("Drag and drop your recording here").closest("label")!;
    fireEvent.dragLeave(dropzone);
    expect(setIsDragging).toHaveBeenCalledWith(false);
  });
});
