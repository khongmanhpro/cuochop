// @vitest-environment happy-dom

/**
 * Component tests for EmptyState.
 *
 * Verifies:
 * - Renders title and description
 * - Renders icon when provided
 * - Does not render icon container when icon not provided
 * - Renders CTA link when provided
 * - Does not render CTA when not provided
 * - CTA link has correct href
 */

import { afterEach, describe, expect, test } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { EmptyState } from "@/components/empty-state";

afterEach(() => cleanup());

describe("EmptyState", () => {
  test("renders title and description", () => {
    render(
      <EmptyState
        title="Chưa có cuộc họp nào"
        description="Tạo meeting notes đầu tiên."
      />,
    );

    expect(screen.getByText("Chưa có cuộc họp nào")).toBeInTheDocument();
    expect(
      screen.getByText("Tạo meeting notes đầu tiên."),
    ).toBeInTheDocument();
  });

  test("renders icon when provided", () => {
    render(
      <EmptyState
        title="Empty"
        description="Nothing here"
        icon="📋"
      />,
    );

    expect(screen.getByText("📋")).toBeInTheDocument();
  });

  test("does not render icon container when icon not provided", () => {
    render(
      <EmptyState title="Empty" description="Nothing here" />,
    );

    expect(screen.queryByText("📋")).not.toBeInTheDocument();
  });

  test("renders CTA link when provided", () => {
    render(
      <EmptyState
        title="Empty"
        description="Nothing here"
        cta={{ label: "Tạo meeting", href: "/app" }}
      />,
    );

    const link = screen.getByRole("link", { name: "Tạo meeting" });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/app");
  });

  test("does not render CTA when not provided", () => {
    render(
      <EmptyState title="Empty" description="Nothing here" />,
    );

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  test("applies custom className", () => {
    const { container } = render(
      <EmptyState
        title="Empty"
        description="Nothing here"
        className="my-custom-class"
      />,
    );

    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain("my-custom-class");
  });
});
