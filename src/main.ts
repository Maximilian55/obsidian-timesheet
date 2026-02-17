import { Notice, Plugin } from "obsidian";
import { registerCommands } from "./commands";
import { SettingsTab, getDefaultSettings } from "./settings/index";
import { JsonStore } from "./storage/json-store";
import { SessionManager } from "./tracker/session-manager";
import {
  PersistedPluginState,
  TimesheetPluginData,
  TimesheetPluginSettings,
  TimesheetSession,
} from "./types";

function buildTaskHistoryFromSessions(sessions: TimesheetSession[]): Record<string, { name: string; lastUsedAt: string; useCount: number }[]> {
  const byProject = new Map<string, Map<string, { name: string; lastUsedAt: string; useCount: number }>>();

  for (const session of sessions) {
    const project = session.project;
    const task = session.task;
    const when = session.endTime ?? session.startTime;

    if (!byProject.has(project)) {
      byProject.set(project, new Map());
    }

    const map = byProject.get(project)!;
    const key = task.toLowerCase();
    const existing = map.get(key);

    if (existing) {
      map.set(key, {
        ...existing,
        useCount: existing.useCount + 1,
        lastUsedAt: existing.lastUsedAt < when ? when : existing.lastUsedAt,
      });
    } else {
      map.set(key, {
        name: task,
        useCount: 1,
        lastUsedAt: when,
      });
    }
  }

  const output: Record<string, { name: string; lastUsedAt: string; useCount: number }[]> = {};
  for (const [project, entries] of byProject.entries()) {
    output[project] = [...entries.values()];
  }

  return output;
}

export default class TimesheetPlugin extends Plugin {
  public settings: TimesheetPluginSettings = getDefaultSettings();
  public data: TimesheetPluginData = {
    schemaVersion: 1,
    sessions: [],
    taskHistoryByProject: {},
  };

  public jsonStore!: JsonStore;
  public sessionManager!: SessionManager;

  private legacySessions: TimesheetSession[] = [];

  async onload(): Promise<void> {
    await this.loadState();

    this.jsonStore = new JsonStore(this.app, this.settings.timesheetJsonPath);

    const stored = await this.jsonStore.load();
    if (stored.sessions.length === 0 && this.legacySessions.length > 0) {
      this.data = {
        schemaVersion: 1,
        sessions: [...this.legacySessions],
        taskHistoryByProject: buildTaskHistoryFromSessions(this.legacySessions),
      };
      await this.jsonStore.save(this.data);
    } else {
      this.data = stored;
    }

    this.sessionManager = new SessionManager(this.data, async (data) => {
      await this.persistData(data);
    });

    this.addSettingTab(new SettingsTab(this));
    registerCommands(this);

    new Notice("Timesheet plugin loaded.");
  }

  async updateSettings(partial: Partial<TimesheetPluginSettings>): Promise<void> {
    const previousJsonPath = this.settings.timesheetJsonPath;

    this.settings = {
      ...this.settings,
      ...partial,
    };

    await this.saveState();

    if (previousJsonPath !== this.settings.timesheetJsonPath) {
      this.jsonStore = new JsonStore(this.app, this.settings.timesheetJsonPath);
      await this.jsonStore.save(this.data);
      new Notice("Timesheet JSON path updated.");
    }
  }

  private async loadState(): Promise<void> {
    const raw = ((await this.loadData()) ?? {}) as PersistedPluginState;

    this.settings = {
      ...getDefaultSettings(),
      ...(raw.settings ?? {}),
    };

    this.legacySessions = Array.isArray(raw.sessions) ? raw.sessions : [];
  }

  private async persistData(data: TimesheetPluginData): Promise<void> {
    this.data = data;
    await this.saveState();
    await this.jsonStore.save(this.data);
  }

  private async saveState(): Promise<void> {
    await this.saveData({
      settings: this.settings,
    });
  }
}
