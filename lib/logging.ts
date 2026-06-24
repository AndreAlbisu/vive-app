import * as FileSystem from "expo-file-system";

const LOG_FILE = FileSystem.documentDirectory + "error.log";

function formatEntry(level: string, message: string, error?: unknown): string {
  const timestamp = new Date().toISOString();
  const detail =
    error instanceof Error ? `\n  ${error.stack ?? error.message}` : "";
  return `[${timestamp}] [${level}] ${message}${detail}\n`;
}

async function append(entry: string) {
  try {
    const info = await FileSystem.getInfoAsync(LOG_FILE);
    const existing = info.exists
      ? await FileSystem.readAsStringAsync(LOG_FILE)
      : "";
    await FileSystem.writeAsStringAsync(LOG_FILE, existing + entry, {
      encoding: FileSystem.EncodingType.UTF8,
    });
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
    const info = await FileSystem.getInfoAsync(LOG_FILE);
    if (!info.exists) return "";
    return await FileSystem.readAsStringAsync(LOG_FILE);
  } catch {
    return "";
  }
}

export async function clearLog() {
  try {
    await FileSystem.deleteAsync(LOG_FILE, { idempotent: true });
  } catch {
    // ignore
  }
}
