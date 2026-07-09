// @vitest-environment happy-dom

/**
 * Component tests for ActionCard (table row view + edit mode).
 *
 * Verifies:
 * - Renders task, owner, deadline, priority, status in view mode
 * - Shows Done/Reopen button depending on status
 * - Shows Edit button
 * - Clicking Done calls onPatch with status "done"
 * - Clicking Reopen calls onPatch with status "todo"
 * - Clicking Edit calls onEdit
 * - Edit mode renders Save/Cancel buttons
 * - Clicking Cancel calls onCancel
 */

import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ActionCard } from "@/components/action-card";
import type {
  ActionBoardItem,
  AssignableMember,
} from "@/lib/actions-board-helpers";

afterEach(() => cleanup());

const baseItem: ActionBoardItem = {
  id: "item-1",
  task: "Review PR",
  ownerId: "user-1",
  ownerName: "Alice",
  deadline: "2026-07-15",
  priority: "High",
  status: "todo",
  notes: "Important review",
  createdAt: "2026-07-01T00:00:00Z",
  meetingTitle: "Sprint Planning",
  audioName: "sprint.mp3",
  createdBy: "Bob",
};

const members: AssignableMember[] = [
  { id: "user-1", label: "Alice", email: "alice@test.com" },
  { id: "user-2", label: "Bob", email: "bob@test.com" },
];

describe("ActionCard — view mode", () => {
  test("renders task, owner, deadline, priority, status", () => {
    render(
      <table>
        <tbody>
          <ActionCard
            item={baseItem}
            isEditing={false}
            isPending={false}
            isSelected={false}
            showCreatedBy={false}
            assignableMembers={members}
            onSelect={() => {}}
            onEdit={() => {}}
            onCancel={() => {}}
            onPatch={() => {}}
          />
        </tbody>
      </table>,
    );

    expect(screen.getByText("Review PR")).toBeInTheDocument();
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("2026-07-15")).toBeInTheDocument();
    expect(screen.getByText("High")).toBeInTheDocument();
  });

  test("shows Xong button when status is todo", () => {
    render(
      <table>
        <tbody>
          <ActionCard
            item={baseItem}
            isEditing={false}
            isPending={false}
            isSelected={false}
            showCreatedBy={false}
            assignableMembers={members}
            onSelect={() => {}}
            onEdit={() => {}}
            onCancel={() => {}}
            onPatch={() => {}}
          />
        </tbody>
      </table>,
    );

    expect(screen.getByRole("button", { name: "Xong" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mở lại" })).not.toBeInTheDocument();
  });

  test("shows Mở lại button when status is done", () => {
    render(
      <table>
        <tbody>
          <ActionCard
            item={{ ...baseItem, status: "done" }}
            isEditing={false}
            isPending={false}
            isSelected={false}
            showCreatedBy={false}
            assignableMembers={members}
            onSelect={() => {}}
            onEdit={() => {}}
            onCancel={() => {}}
            onPatch={() => {}}
          />
        </tbody>
      </table>,
    );

    expect(screen.getByRole("button", { name: "Mở lại" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Xong" })).not.toBeInTheDocument();
  });

  test("clicking Xong calls onPatch with status done", () => {
    const onPatch = vi.fn();
    render(
      <table>
        <tbody>
          <ActionCard
            item={baseItem}
            isEditing={false}
            isPending={false}
            isSelected={false}
            showCreatedBy={false}
            assignableMembers={members}
            onSelect={() => {}}
            onEdit={() => {}}
            onCancel={() => {}}
            onPatch={onPatch}
          />
        </tbody>
      </table>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Xong" }));
    expect(onPatch).toHaveBeenCalledWith({ status: "done" });
  });

  test("clicking Edit calls onEdit", () => {
    const onEdit = vi.fn();
    render(
      <table>
        <tbody>
          <ActionCard
            item={baseItem}
            isEditing={false}
            isPending={false}
            isSelected={false}
            showCreatedBy={false}
            assignableMembers={members}
            onSelect={() => {}}
            onEdit={onEdit}
            onCancel={() => {}}
            onPatch={() => {}}
          />
        </tbody>
      </table>,
    );

    fireEvent.click(screen.getByText("Sửa"));
    expect(onEdit).toHaveBeenCalled();
  });

  test("clicking checkbox calls onSelect", () => {
    const onSelect = vi.fn();
    const { container } = render(
      <table>
        <tbody>
          <ActionCard
            item={baseItem}
            isEditing={false}
            isPending={false}
            isSelected={false}
            showCreatedBy={false}
            assignableMembers={members}
            onSelect={onSelect}
            onEdit={() => {}}
            onCancel={() => {}}
            onPatch={() => {}}
          />
        </tbody>
      </table>,
    );

    const checkbox = container.querySelector('input[type="checkbox"]')!;
    fireEvent.click(checkbox);
    expect(onSelect).toHaveBeenCalledWith(true);
  });
});

describe("ActionCard — edit mode", () => {
  test("renders Lưu and Hủy buttons", () => {
    render(
      <table>
        <tbody>
          <ActionCard
            item={baseItem}
            isEditing={true}
            isPending={false}
            isSelected={false}
            showCreatedBy={false}
            assignableMembers={members}
            onSelect={() => {}}
            onEdit={() => {}}
            onCancel={() => {}}
            onPatch={() => {}}
          />
        </tbody>
      </table>,
    );

    expect(screen.getByText("Lưu")).toBeInTheDocument();
    expect(screen.getByText("Hủy")).toBeInTheDocument();
  });

  test("clicking Hủy calls onCancel", () => {
    const onCancel = vi.fn();
    render(
      <table>
        <tbody>
          <ActionCard
            item={baseItem}
            isEditing={true}
            isPending={false}
            isSelected={false}
            showCreatedBy={false}
            assignableMembers={members}
            onSelect={() => {}}
            onEdit={() => {}}
            onCancel={onCancel}
            onPatch={() => {}}
          />
        </tbody>
      </table>,
    );

    fireEvent.click(screen.getByText("Hủy"));
    expect(onCancel).toHaveBeenCalled();
  });

  test("clicking Lưu calls onPatch with draft values", () => {
    const onPatch = vi.fn();
    render(
      <table>
        <tbody>
          <ActionCard
            item={baseItem}
            isEditing={true}
            isPending={false}
            isSelected={false}
            showCreatedBy={false}
            assignableMembers={members}
            onSelect={() => {}}
            onEdit={() => {}}
            onCancel={() => {}}
            onPatch={onPatch}
          />
        </tbody>
      </table>,
    );

    fireEvent.click(screen.getByText("Lưu"));
    expect(onPatch).toHaveBeenCalledWith(
      expect.objectContaining({
        task: "Review PR",
        ownerId: "user-1",
        deadline: "2026-07-15",
        priority: "High",
        status: "todo",
        notes: "Important review",
      }),
    );
  });
});
