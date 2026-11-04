import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { isFilePickerOpen, watchFilePickers } from "./filePickerLock";

describe("file picker lock pause", () => {
  let stop: () => void;
  let input: HTMLInputElement;

  beforeEach(() => {
    stop = watchFilePickers();
    input = document.createElement("input");
    input.type = "file";
    input.className = "hidden";
    document.body.appendChild(input);
  });

  afterEach(() => {
    stop();
    input.remove();
  });

  it("is off until a file input is opened", () => {
    expect(isFilePickerOpen()).toBe(false);
    input.click();
    expect(isFilePickerOpen()).toBe(true);
  });

  it("ignores other clicks", () => {
    document.body.click();
    expect(isFilePickerOpen()).toBe(false);
  });

  it.each(["change", "cancel"])("ends on %s", name => {
    input.click();
    input.dispatchEvent(new Event(name, { bubbles: true }));
    expect(isFilePickerOpen()).toBe(false);
  });

  it("stops waiting after five minutes, so an abandoned picker can't keep the app unlocked", () => {
    input.click();
    expect(isFilePickerOpen(Date.now() + 4 * 60 * 1000)).toBe(true);
    expect(isFilePickerOpen(Date.now() + 6 * 60 * 1000)).toBe(false);
  });
});
