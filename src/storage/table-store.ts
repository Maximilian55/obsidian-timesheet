import { App } from "obsidian";
import { TimesheetSession, TimesheetPluginSettings } from "../types";
import { formatDuration } from "../tracker/duration";
import { writeTextFile } from "./file-io";

function sanitizeInlineValue(input: string): string {
  return input.replace(/\r?\n/g, " ").trim();
}

function buildSessionBlock(session: TimesheetSession): string {
  const project = sanitizeInlineValue(session.project);
  const task = sanitizeInlineValue(session.task);
  const start = session.startTime;
  const end = session.endTime ?? "";
  const durationMin = session.endTime ? String(session.durationMinutes ?? 0) : "";
  const durationLabel = session.endTime ? formatDuration(session.durationMinutes) : "";
  const status = session.endTime ? "stopped" : "active";

  return [
    `- session_id:: ${session.id}`,
    `  project:: ${project}`,
    `  task:: ${task}`,
    `  start:: ${start}`,
    `  end:: ${end}`,
    `  duration_min:: ${durationMin}`,
    `  duration_label:: ${durationLabel}`,
    `  status:: ${status}`,
  ].join("\n");
}

function buildDataviewDocument(sessions: TimesheetSession[]): string {
  const sorted = [...sessions].sort((a, b) => (a.startTime < b.startTime ? 1 : -1));
  const lines: string[] = [
    "# Timesheet",
    "",
    "<!-- Source of truth for Dataview -->",
    "",
  ];

  for (const session of sorted) {
    lines.push(buildSessionBlock(session));
    lines.push("");
  }

  return lines.join("\n");
}

export class TableStore {
  private readonly app: App;
  private readonly settings: TimesheetPluginSettings;

  constructor(app: App, settings: TimesheetPluginSettings) {
    this.app = app;
    this.settings = settings;
  }

  async syncSessions(sessions: TimesheetSession[]): Promise<void> {
    const content = buildDataviewDocument(sessions);
    await writeTextFile(this.app, this.settings.timesheetFilePath, content);
  }
}
