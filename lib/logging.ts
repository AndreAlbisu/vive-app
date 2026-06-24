import { File, Paths } from "expo-file-system";

function logFile() {
  return new File(Paths.document, "error.log");
}

function formatEntry(level: string, message: string, error?: unknown): string {
  const timestamp = new Date().toISOString();
  const detail =
    error instanceof Error ? `\n  ${error.stack ?? error.message}` : "";
  return `[${timestamp}] [${level}] ${message}${detail}\n`;
}

async function append(entry: string) {
  try {
    const file = logFile();
    const existing = file.exists ? await file.text() : "";
    file.write(existing + entry);
  } catch {
    // Silently fail — logging must not crash the app
  }
}

export async function logError(message: string, error?: unknown) {
  await append(formatEntry("ERROR", message, error));
}

export async function logWarn(message: string) {
  await append(formatEntry("WARN", message));
}

export async function logInfo(message: string) {
  await append(formatEntry("INFO", message));
}

export async function readLog(): Promise<string> {
  try {
    const file = logFile();
    if (!file.exists) return "";
    return await file.text();
  } catch {
    return "";
  }
}

export async function clearLog() {
  try {
    const file = logFile();
    if (file.exists) file.delete();
  } catch {
    // ignore
  }
}
