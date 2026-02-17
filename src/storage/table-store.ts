import { App } from "obsidian";
import { TimesheetSession, TimesheetPluginSettings } from "../types";
import { formatDuration } from "../tracker/duration";
import { writeTextFile } from "./file-io";

function escapeCell(input: string): string {
  return input.replace(/\|/g, "\\|");
}

function buildRow(session: TimesheetSession): string {
  const project = escapeCell(session.project);
  const task = escapeCell(session.task);
  const start = session.startTime;
  const end = session.endTime ?? "";
  const duration = session.endTime ? formatDuration(session.durationMinutes) : "";

  return `| ${project} | ${task} | ${start} | ${end} | ${duration} |`;
}

function buildTable(sessions: TimesheetSession[]): string {
  const sorted = [...sessions].sort((a, b) => (a.startTime < b.startTime ? 1 : -1));
  const lines: string[] = [
    "# Timesheet",
    "",
    "| project | task | start time | end time | duration |",
    "| --- | --- | --- | --- | --- |",
  ];

  for (const session of sorted) {
    lines.push(buildRow(session));
  }

  lines.push("");
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
    const table = buildTable(sessions);
    await writeTextFile(this.app, this.settings.timesheetFilePath, table);
  }
}
