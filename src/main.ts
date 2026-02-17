import { Notice, Plugin } from "obsidian";
import { registerCommands } from "./commands";
import { SettingsTab, getDefaultSettings } from "./settings/index";
import { TableStore } from "./storage/table-store";
import { SessionManager } from "./tracker/session-manager";
import {
  PersistedPluginState,
  TimesheetPluginData,
  TimesheetPluginSettings,
  TimesheetSession,
} from "./types";

export default class TimesheetPlugin extends Plugin {
  public settings: TimesheetPluginSettings = getDefaultSettings();
  public data: TimesheetPluginData = { sessions: [] };

  public tableStore!: TableStore;
  public sessionManager!: SessionManager;

  async onload(): Promise<void> {
    await this.loadState();

    this.tableStore = new TableStore(this.app, this.settings);
    this.sessionManager = new SessionManager(this.data, async (sessions) => {
      await this.persistSessions(sessions);
    });

    this.addSettingTab(new SettingsTab(this));
    registerCommands(this);

    await this.tableStore.syncSessions(this.sessionManager.getAllSessions());
    new Notice("Timesheet plugin loaded.");
  }

  async updateSettings(partial: Partial<TimesheetPluginSettings>): Promise<void> {
    this.settings = {
      ...this.settings,
      ...partial,
    };

    this.tableStore = new TableStore(this.app, this.settings);
    await this.saveState();
    await this.tableStore.syncSessions(this.sessionManager.getAllSessions());
  }

  private async loadState(): Promise<void> {
    const raw = ((await this.loadData()) ?? {}) as PersistedPluginState;

    this.settings = {
      ...getDefaultSettings(),
      ...(raw.settings ?? {}),
    };

    this.data = {
      sessions: Array.isArray(raw.sessions) ? raw.sessions : [],
    };
  }

  private async persistSessions(sessions: TimesheetSession[]): Promise<void> {
    this.data.sessions = sessions;
    await this.saveState();
    await this.tableStore.syncSessions(sessions);
  }

  private async saveState(): Promise<void> {
    await this.saveData({
      settings: this.settings,
      sessions: this.data.sessions,
    });
  }
}
