import { computeDurationMinutes } from "./duration";
import { TimesheetPluginData, TimesheetSession } from "../types";

function generateSessionId(): string {
  return `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

export class SessionManager {
  private readonly data: TimesheetPluginData;
  private readonly onChange: (sessions: TimesheetSession[]) => Promise<void>;

  constructor(
    data: TimesheetPluginData,
    onChange: (sessions: TimesheetSession[]) => Promise<void>,
  ) {
    this.data = data;
    this.onChange = onChange;
  }

  getAllSessions(): TimesheetSession[] {
    return [...this.data.sessions];
  }

  getActiveSessions(): TimesheetSession[] {
    return this.data.sessions.filter((session) => !session.endTime);
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
    await this.onChange(this.getAllSessions());
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

    await this.onChange(this.getAllSessions());
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

    await this.onChange(this.getAllSessions());
    return active.length;
  }
}
