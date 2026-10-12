// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CustomSelect } from "./custom-select";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  act(() => root.render(
    <form>
      <button id="before" type="button">Before</button>
      <label htmlFor="status">Status</label>
      <CustomSelect
        defaultValue="open"
        id="status"
        name="status"
        options={[
          { value: "", label: "All statuses" },
          { value: "open", label: "Open" },
          { value: "in_progress", label: "In progress" },
          { value: "resolved", label: "Resolved" },
          { value: "closed", label: "Closed" },
        ]}
      />
      <button id="after" type="submit">Apply filters</button>
      <div id="outside">Non-focusable outside content</div>
    </form>,
  ));
  act(() => trigger().focus());
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

function trigger() {
  return container.querySelector<HTMLButtonElement>("#status")!;
}

function press(key: string, init: KeyboardEventInit = {}, timestamp?: number) {
  const event = new KeyboardEvent("keydown", {
    key,
    bubbles: true,
    cancelable: true,
    ...init,
  });
  if (timestamp !== undefined) Object.defineProperty(event, "timeStamp", { value: timestamp });
  act(() => document.activeElement!.dispatchEvent(event));
  return event;
}

function formValue() {
  return new FormData(container.querySelector("form")!).get("status");
}

function activeOption() {
  return document.getElementById(trigger().getAttribute("aria-activedescendant") ?? "");
}

function expectClosed() {
  expect(trigger().getAttribute("aria-expanded")).toBe("false");
  expect(trigger().hasAttribute("aria-activedescendant")).toBe(false);
  expect(container.querySelector('[role="listbox"]')).toBeNull();
}

describe("CustomSelect", () => {
  it("exposes a named combobox, its current value, and the selected option", () => {
    expect(trigger().getAttribute("role")).toBe("combobox");
    expect(trigger().labels?.[0].textContent).toBe("Status");
    expect(document.getElementById(trigger().getAttribute("aria-describedby")!)?.textContent).toBe("Open");
    expect(formValue()).toBe("open");

    expect(press("ArrowDown").defaultPrevented).toBe(true);

    expect(document.activeElement).toBe(trigger());
    expect(trigger().getAttribute("aria-expanded")).toBe("true");
    expect(activeOption()?.textContent).toBe("Open");
    expect(activeOption()?.getAttribute("aria-selected")).toBe("true");
    const listbox = container.querySelector('[role="listbox"]')!;
    expect(listbox.id).toBe(trigger().getAttribute("aria-controls"));
    expect(listbox.hasAttribute("aria-activedescendant")).toBe(false);
    expect([...listbox.querySelectorAll<HTMLElement>('[role="option"]')].every((option) => option.tabIndex === -1)).toBe(true);
  });

  it.each(["Enter", " "])("commits keyboard navigation with %j without submitting the form", (key) => {
    expect(press(key).defaultPrevented).toBe(true);
    press("ArrowDown");
    expect(activeOption()?.textContent).toBe("In progress");
    expect(formValue()).toBe("open");
    expect(container.querySelector('[aria-selected="true"]')?.textContent).toBe("Open");
    expect(activeOption()?.getAttribute("data-active")).toBe("true");

    expect(press(key).defaultPrevented).toBe(true);

    expectClosed();
    expect(formValue()).toBe("in_progress");
    expect(trigger().textContent).toBe("In progress");
    expect(document.activeElement).toBe(trigger());
  });

  it("cancels pending navigation with Escape and reopens on the committed value", () => {
    press("ArrowDown");
    press("ArrowDown");
    expect(press("Escape").defaultPrevented).toBe(true);

    expectClosed();
    expect(formValue()).toBe("open");
    expect(document.activeElement).toBe(trigger());
    press("ArrowUp");
    expect(activeOption()?.textContent).toBe("Open");
  });

  it.each([false, true])("commits on Tab (shift=%s) without trapping focus", (shiftKey) => {
    press("ArrowDown");
    press("ArrowDown");
    expect(press("Tab", { shiftKey }).defaultPrevented).toBe(false);
    expectClosed();
    expect(formValue()).toBe("in_progress");

    const next = container.querySelector<HTMLButtonElement>(shiftKey ? "#before" : "#after")!;
    act(() => next.focus());
    expect(document.activeElement).toBe(next);
  });

  it("supports Home, End, and bounded arrow navigation", () => {
    press("Home");
    expect(activeOption()?.textContent).toBe("All statuses");
    press("ArrowUp");
    expect(activeOption()?.textContent).toBe("All statuses");
    press("End");
    expect(activeOption()?.textContent).toBe("Closed");
    press("ArrowDown");
    expect(activeOption()?.textContent).toBe("Closed");
    press("Enter");
    expect(formValue()).toBe("closed");
    press("Home");
    press("Enter");
    expect(formValue()).toBe("");
    press("End");
    expect(activeOption()?.textContent).toBe("Closed");
  });

  it("supports case-insensitive typeahead without changing the committed value", () => {
    press("R");
    press("e");
    expect(activeOption()?.textContent).toBe("Resolved");
    expect(formValue()).toBe("open");
    press("Enter");
    expect(formValue()).toBe("resolved");
    press("c", { ctrlKey: true });
    expectClosed();
  });

  it("cycles repeated typeahead keys and resets the search after a pause", () => {
    act(() => root.render(
      <CustomSelect
        defaultValue="open"
        id="status"
        name="status"
        options={[
          { value: "open", label: "Open" },
          { value: "pending", label: "Pending" },
          { value: "paused", label: "Paused" },
          { value: "resolved", label: "Resolved" },
        ]}
      />,
    ));
    act(() => trigger().focus());
    press("p", {}, 1000);
    expect(activeOption()?.textContent).toBe("Pending");
    press("p", {}, 1100);
    expect(activeOption()?.textContent).toBe("Paused");
    press("p", {}, 1200);
    expect(activeOption()?.textContent).toBe("Pending");
    press("r", {}, 2000);
    expect(activeOption()?.textContent).toBe("Resolved");
    press("Escape");
    expect(trigger().textContent).toBe("Open");
  });

  it("selects pointer options while keeping focus on the combobox", () => {
    act(() => trigger().click());
    const option = container.querySelector<HTMLElement>("#status-option-3")!;
    const down = new PointerEvent("pointerdown", { bubbles: true, cancelable: true });
    act(() => option.dispatchEvent(down));
    expect(down.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(trigger());
    act(() => option.click());
    expectClosed();
    expect(formValue()).toBe("resolved");
    expect(document.activeElement).toBe(trigger());

    act(() => trigger().click());
    press("Escape");
    expectClosed();
  });

  it("dismisses on outside pointer interaction even when the target cannot receive focus", () => {
    press("ArrowDown");
    press("ArrowDown");
    act(() => container.querySelector("#outside")!.dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true }),
    ));
    expectClosed();
    expect(formValue()).toBe("in_progress");
  });

  it("cancels pointer-highlighted options on Escape without moving DOM focus into the popup", () => {
    act(() => trigger().click());
    const option = container.querySelector<HTMLElement>("#status-option-3")!;
    act(() => option.dispatchEvent(new PointerEvent("pointermove", { bubbles: true })));
    expect(activeOption()).toBe(option);
    expect(document.activeElement).toBe(trigger());
    press("Escape");
    expectClosed();
    expect(formValue()).toBe("open");
  });

  it("commits on blur without stealing focus from the next control", () => {
    press("ArrowDown");
    press("ArrowDown");
    const next = container.querySelector<HTMLButtonElement>("#after")!;
    act(() => next.focus());
    expectClosed();
    expect(formValue()).toBe("in_progress");
    expect(document.activeElement).toBe(next);
  });
});
