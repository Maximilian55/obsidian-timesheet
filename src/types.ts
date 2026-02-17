export interface TimesheetSession {
  id: string;
  project: string;
  task: string;
  startTime: string;
  endTime?: string;
  durationMinutes?: number;
}

export interface TaskHistoryEntry {
  name: string;
  lastUsedAt: string;
  useCount: number;
}

export interface TimesheetPluginData {
  schemaVersion: number;
  sessions: TimesheetSession[];
  taskHistoryByProject: Record<string, TaskHistoryEntry[]>;
}

export interface TimesheetPluginSettings {
  timesheetJsonPath: string;
  projectNotesFolder: string;
}

export interface PersistedPluginState {
  settings?: Partial<TimesheetPluginSettings>;
  sessions?: TimesheetSession[];
}
