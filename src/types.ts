export interface TimesheetSession {
  id: string;
  project: string;
  task: string;
  startTime: string;
  endTime?: string;
  durationMinutes?: number;
}

export interface TimesheetPluginData {
  sessions: TimesheetSession[];
}

export interface TimesheetPluginSettings {
  timesheetFilePath: string;
  projectNotesFolder: string;
}

export interface PersistedPluginState {
  settings?: Partial<TimesheetPluginSettings>;
  sessions?: TimesheetSession[];
}
