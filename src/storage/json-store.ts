import { App } from "obsidian";
import { readTextFile, writeTextFile } from "./file-io";
import { TimesheetPluginData } from "../types";

const SCHEMA_VERSION = 1;

function getDefaultData(): TimesheetPluginData {
  return {
    schemaVersion: SCHEMA_VERSION,
    sessions: [],
    taskHistoryByProject: {},
  };
}

function normalizeData(raw: unknown): TimesheetPluginData {
  if (!raw || typeof raw !== "object") {
    return getDefaultData();
  }

  const maybe = raw as Partial<TimesheetPluginData>;
  return {
    schemaVersion: typeof maybe.schemaVersion === "number" ? maybe.schemaVersion : SCHEMA_VERSION,
    sessions: Array.isArray(maybe.sessions) ? maybe.sessions : [],
    taskHistoryByProject:
      maybe.taskHistoryByProject && typeof maybe.taskHistoryByProject === "object"
        ? maybe.taskHistoryByProject
        : {},
  };
}

export class JsonStore {
  private readonly app: App;
  private readonly path: string;

  constructor(app: App, path: string) {
    this.app = app;
    this.path = path;
  }

  async load(): Promise<TimesheetPluginData> {
    const content = await readTextFile(this.app, this.path);
    if (!content || content.trim().length === 0) {
      return getDefaultData();
    }

    try {
      const parsed = JSON.parse(content) as unknown;
      return normalizeData(parsed);
    } catch {
      return getDefaultData();
    }
  }

  async save(data: TimesheetPluginData): Promise<void> {
    const normalized = normalizeData(data);
    const serialized = JSON.stringify(normalized, null, 2);
    await writeTextFile(this.app, this.path, serialized + "\n");
  }
}
