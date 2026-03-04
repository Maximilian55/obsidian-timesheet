import { Events, Notice, Plugin, PluginSettingTab, Setting } from "obsidian";
import { JsonStore } from "./store";
import { Session } from "./types";
import { StatusBarTimer } from "./statusbar";
import { SessionsView, VIEW_TYPE } from "./sessions-view";
import { StartModal, StopModal } from "./modals";

const SESSIONS_JSON_PATH = "Timesheets/timesheet-data.json";

// ── Settings ──────────────────────────────────────────────────────────────────

interface PluginSettings {
  projectFolder: string;
}

function defaultSettings(): PluginSettings {
  return {
    projectFolder: "notes/projects",
  };
}

// ── Plugin ────────────────────────────────────────────────────────────────────

export default class TimesheetPlugin extends Plugin {
  sessions: Session[] = [];
  jsonStore!: JsonStore;
  settings: PluginSettings = defaultSettings();
  readonly events = new Events();

  private statusBarTimer: StatusBarTimer | null = null;

  async onload(): Promise<void> {
    // Load persisted settings
    const saved = (await this.loadData()) as
      | Partial<{ settings: Partial<PluginSettings> }>
      | null
      | undefined;
    this.settings = { ...defaultSettings(), ...(saved?.settings ?? {}) };

    // Load sessions from JSON file
    this.jsonStore = new JsonStore(this.app, SESSIONS_JSON_PATH);
    this.sessions = await this.jsonStore.load();

    // Register sidebar view
    this.registerView(VIEW_TYPE, (leaf) => new SessionsView(leaf, this));

    // Status bar
    const statusBarEl = this.addStatusBarItem();
    this.statusBarTimer = new StatusBarTimer(this, statusBarEl);

    // Commands
    this.addCommand({
      id: "start-task",
      name: "Start Task",
      callback: () => new StartModal(this).open(),
    });

    this.addCommand({
      id: "stop-task",
      name: "Stop Task",
      callback: () => new StopModal(this).open(),
    });

    this.addCommand({
      id: "stop-all-tasks",
      name: "Stop All Tasks",
      callback: async () => {
        const active = this.getActiveSessions();
        if (active.length === 0) {
          new Notice("No active tasks.");
          return;
        }
        for (const s of active) await this.stopSession(s.id);
        new Notice(`Stopped ${active.length} task(s).`);
      },
    });

    this.addCommand({
      id: "open-sessions-view",
      name: "Open Timesheet",
      callback: async () => {
        const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE);
        if (existing.length > 0) {
          this.app.workspace.revealLeaf(existing[0]);
          return;
        }
        const leaf =
          this.app.workspace.getRightLeaf(false) ??
          this.app.workspace.getLeaf(true);
        await leaf.setViewState({ type: VIEW_TYPE, active: true });
        this.app.workspace.revealLeaf(leaf);
      },
    });

    // Settings tab
    this.addSettingTab(new TimesheetSettingsTab(this));

    new Notice("Timesheet plugin loaded.");
  }

  async onunload(): Promise<void> {
    this.statusBarTimer?.destroy();
  }

  // ── Mutations (each saves + fires "sessions-changed") ─────────────────────

  async startSession(project: string, task: string): Promise<Session> {
    const session: Session = {
      id: `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`,
      project,
      task,
      start: new Date().toISOString(),
    };
    this.sessions.push(session);
    await this.persist();
    const projectName = project.replace(/^\[\[|\]\]$/g, "");
    new Notice(`Started: ${projectName} — ${task}`);
    return session;
  }

  async stopSession(id: string): Promise<void> {
    const session = this.sessions.find((s) => s.id === id && !s.end);
    if (!session) return;
    session.end = new Date().toISOString();
    await this.persist();
    const projectName = session.project.replace(/^\[\[|\]\]$/g, "");
    new Notice(`Stopped: ${projectName} — ${session.task}`);
  }

  async editSession(id: string, patch: Omit<Partial<Session>, "id">): Promise<void> {
    const session = this.sessions.find((s) => s.id === id);
    if (!session) return;
    Object.assign(session, patch);
    await this.persist();
  }

  async deleteSession(id: string): Promise<void> {
    this.sessions = this.sessions.filter((s) => s.id !== id);
    await this.persist();
  }

  // ── Queries (derived, no stored state) ───────────────────────────────────

  getActiveSessions(): Session[] {
    return this.sessions.filter((s) => !s.end);
  }

  getTaskSuggestions(project: string): string[] {
    const byTask = new Map<string, { name: string; lastUsed: string; count: number }>();
    for (const s of this.sessions) {
      if (s.project !== project) continue;
      const key = s.task.toLowerCase();
      const existing = byTask.get(key);
      const when = s.end ?? s.start;
      if (!existing) {
        byTask.set(key, { name: s.task, lastUsed: when, count: 1 });
      } else {
        byTask.set(key, {
          name: existing.name,
          lastUsed: existing.lastUsed < when ? when : existing.lastUsed,
          count: existing.count + 1,
        });
      }
    }
    return [...byTask.values()]
      .sort((a, b) => b.count - a.count || b.lastUsed.localeCompare(a.lastUsed))
      .map((e) => e.name);
  }

  // ── Settings ──────────────────────────────────────────────────────────────

  async updateSettings(partial: Partial<PluginSettings>): Promise<void> {
    this.settings = { ...this.settings, ...partial };
    await this.saveData({ settings: this.settings });
  }

  // ── Persistence ───────────────────────────────────────────────────────────

  private async persist(): Promise<void> {
    await this.jsonStore.save(this.sessions);
    await this.saveData({ settings: this.settings });
    this.events.trigger("sessions-changed");
  }
}

// ── Settings tab ──────────────────────────────────────────────────────────────

class TimesheetSettingsTab extends PluginSettingTab {
  private readonly plugin: TimesheetPlugin;

  constructor(plugin: TimesheetPlugin) {
    super(plugin.app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Timesheet" });

    new Setting(containerEl)
      .setName("Project notes folder")
      .setDesc("Only notes in this folder appear in the project picker.")
      .addText((text) => {
        text
          .setPlaceholder("notes/projects")
          .setValue(this.plugin.settings.projectFolder)
          .onChange(async (value) => {
            await this.plugin.updateSettings({ projectFolder: value.trim() });
          });
      });
  }
}
