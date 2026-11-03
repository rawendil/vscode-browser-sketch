/** What a visible tab (the active tab of an editor group) looks like to us. */
export type VisibleTab<T> =
  | { kind: "image"; uri: T }
  /** No API type — the Integrated Browser looks like this (as do a few built-in editors). */
  | { kind: "unknown" }
  | { kind: "other" };

/**
 * The image Ctrl+Alt+S should open instead of screenshotting the browser, or `undefined` to screenshot.
 * The focused tab wins. Otherwise a visible image preview counts only when no tab that may be
 * a browser is visible — focus is often in another panel, such as a chat, while the image is on screen.
 */
export function pickVisibleImage<T>(focused: VisibleTab<T> | undefined, others: VisibleTab<T>[]): T | undefined {
  if (focused?.kind === "image") return focused.uri;
  if (others.some((t) => t.kind === "unknown") || focused?.kind === "unknown") return undefined;
  return firstVisibleImage(focused, others);
}

/** The image "Open Image in Sketch" should take: the focused one, else any visible one — a browser does not matter here. */
export function firstVisibleImage<T>(focused: VisibleTab<T> | undefined, others: VisibleTab<T>[]): T | undefined {
  const visible = focused ? [focused, ...others] : others;
  return visible.find((t): t is { kind: "image"; uri: T } => t.kind === "image")?.uri;
}

/**
 * Since VS Code 1.144 the image preview is a native editor: its tab has no API input and no URI,
 * only the file name as the label. The Integrated Browser has no input either, but its label is the page title.
 */
export function imageNameFromLabel(label: string): string | undefined {
  return /\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(label) ? label : undefined;
}
