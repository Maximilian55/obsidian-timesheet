import { computeDurationMinutes } from "./duration";
import { TaskHistoryEntry, TimesheetPluginData, TimesheetSession } from "../types";

function generateSessionId(): string {
  return `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

function cloneData(data: TimesheetPluginData): TimesheetPluginData {
  return {
    schemaVersion: data.schemaVersion,
    sessions: [...data.sessions],
    taskHistoryByProject: { ...data.taskHistoryByProject },
  };
}

export class SessionManager {
  private readonly data: TimesheetPluginData;
  private readonly onChange: (data: TimesheetPluginData) => Promise<void>;

  constructor(
    data: TimesheetPluginData,
    onChange: (data: TimesheetPluginData) => Promise<void>,
  ) {
    this.data = data;
    this.onChange = onChange;
  }

  getData(): TimesheetPluginData {
    return cloneData(this.data);
  }

  getAllSessions(): TimesheetSession[] {
    return [...this.data.sessions];
  }

  getActiveSessions(): TimesheetSession[] {
    return this.data.sessions.filter((session) => !session.endTime);
  }

  getTaskSuggestions(project: string): string[] {
    const history = this.data.taskHistoryByProject[project] ?? [];

    return [...history]
      .sort((a, b) => {
        if (a.useCount !== b.useCount) {
          return b.useCount - a.useCount;
        }

        return a.lastUsedAt < b.lastUsedAt ? 1 : -1;
      })
      .map((entry) => entry.name);
  }

  private touchTaskHistory(project: string, task: string, atIso: string): void {
    const existing = this.data.taskHistoryByProject[project] ?? [];
    const byName = new Map<string, TaskHistoryEntry>();

    for (const entry of existing) {
      byName.set(entry.name.toLowerCase(), { ...entry });
    }

    const key = task.toLowerCase();
    const previous = byName.get(key);

    if (previous) {
      byName.set(key, {
        ...previous,
        name: previous.name,
        useCount: previous.useCount + 1,
        lastUsedAt: atIso,
      });
    } else {
      byName.set(key, {
        name: task,
        useCount: 1,
        lastUsedAt: atIso,
      });
    }

    this.data.taskHistoryByProject[project] = [...byName.values()];
  }

  async startSession(project: string, task: string): Promise<TimesheetSession> {
    const now = new Date().toISOString();
    const session: TimesheetSession = {
      id: generateSessionId(),
      project,
      task,
      startTime: now,
    };

    this.data.sessions.push(session);
    this.touchTaskHistory(project, task, now);
    await this.onChange(this.getData());
    return session;
  }

  async stopSession(id: string): Promise<TimesheetSession | null> {
    const session = this.data.sessions.find((candidate) => candidate.id === id && !candidate.endTime);
    if (!session) {
      return null;
    }

    const end = new Date().toISOString();
    session.endTime = end;
    session.durationMinutes = computeDurationMinutes(session.startTime, end);

    await this.onChange(this.getData());
    return session;
  }

  async stopAllSessions(): Promise<number> {
    const active = this.getActiveSessions();
    if (active.length === 0) {
      return 0;
    }

    const end = new Date().toISOString();
    for (const session of active) {
      session.endTime = end;
      session.durationMinutes = computeDurationMinutes(session.startTime, end);
    }

    await this.onChange(this.getData());
    return active.length;
  }
}
