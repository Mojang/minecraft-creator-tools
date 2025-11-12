import { ConsoleMessage, Page } from "@playwright/test";

// List of ignorable messages
const ignorableTokens = [
  "CSSinJS Debug data collection is disabled",
  "You are running Fela in production mode.",
  "is deprecated in StrictMode",
];

export function isIgnorableMessage(message: string): boolean {
  return ignorableTokens.some((ignorable) => message.indexOf(ignorable) >= 0);
}

export function processMessage(
  msg: ConsoleMessage,
  page: Page,
  consoleErrors: { url: string; error: string }[],
  consoleWarnings: { url: string; error: string }[]
) {
  const messageType = msg.type();
  const messageText = msg.text();

  if (!isIgnorableMessage(messageText)) {
    if (messageType === "error") {
      console.log("Page error received: " + messageText);
      consoleErrors.push({
        url: page.url(),
        error: messageText,
      });
    } else if (messageType === "warning") {
      console.log("Page warning received:" + messageText);
      consoleWarnings.push({
        url: page.url(),
        error: messageText,
      });
    }
  }
}
