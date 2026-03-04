import { EventRef, ItemView, Notice, WorkspaceLeaf } from "obsidian";
import type TimesheetPlugin from "./main";
import { Session, formatDuration } from "./types";
import { EditSessionModal, StartModal } from "./modals";

export const VIEW_TYPE = "timesheet-sessions";

function dateLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function groupByDate(sessions: Session[]): Map<string, Session[]> {
  const groups = new Map<string, Session[]>();
  for (const s of [...sessions].sort((a, b) =>
    (b.start ?? "").localeCompare(a.start ?? ""),
  )) {
    const label = dateLabel(s.start);
    const arr = groups.get(label) ?? [];
    arr.push(s);
    groups.set(label, arr);
  }
  return groups;
}

export class SessionsView extends ItemView {
  private readonly plugin: TimesheetPlugin;
  private eventRef: EventRef | null = null;
  private clockInterval: number | null = null;

  constructor(leaf: WorkspaceLeaf, plugin: TimesheetPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return VIEW_TYPE;
  }

  getDisplayText(): string {
    return "Timesheet";
  }

  getIcon(): string {
    return "clock";
  }

  async onOpen(): Promise<void> {
    this.eventRef = this.plugin.events.on("sessions-changed", () =>
      this.render(),
    );
    try {
      this.render();
    } catch (e) {
      new Notice(`Timesheet view error: ${String(e)}`);
      console.error("Timesheet: render failed in onOpen", e);
    }
  }

  async onClose(): Promise<void> {
    this.clearClock();
    if (this.eventRef) {
      this.plugin.events.offref(this.eventRef);
      this.eventRef = null;
    }
  }

  private clearClock(): void {
    if (this.clockInterval !== null) {
      window.clearInterval(this.clockInterval);
      this.clockInterval = null;
    }
  }

  private render(): void {
    this.clearClock();

    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();

    // Header
    const header = container.createDiv();
    header.style.cssText =
      "display:flex;justify-content:space-between;align-items:center;" +
      "padding:8px 12px;border-bottom:1px solid var(--background-modifier-border)";
    header.createEl("strong", { text: "Timesheet" });
    const startBtn = header.createEl("button", { text: "+ Start" });
    startBtn.addEventListener("click", () => new StartModal(this.plugin).open());

    const sessions = [...this.plugin.sessions].sort((a, b) =>
      (b.start ?? "").localeCompare(a.start ?? ""),
    );

    if (sessions.length === 0) {
      const empty = container.createEl("p", { text: "No sessions yet." });
      empty.style.padding = "12px";
      return;
    }

    const content = container.createDiv();
    content.style.padding = "0 12px 12px";

    const groups = groupByDate(sessions);
    for (const [label, groupSessions] of groups) {
      const heading = content.createEl("h6", { text: label });
      heading.style.cssText =
        "margin:12px 0 4px;color:var(--text-muted);font-size:0.75em;text-transform:uppercase;letter-spacing:0.05em";
      for (const session of groupSessions) {
        this.renderRow(content, session);
      }
    }

    // Start live clock for active sessions
    if (this.plugin.getActiveSessions().length > 0) {
      this.clockInterval = window.setInterval(() => {
        const activeRows = container.querySelectorAll<HTMLElement>(
          "[data-session-id][data-active='true']",
        );
        activeRows.forEach((row) => {
          const id = row.dataset.sessionId;
          if (!id) return;
          const session = this.plugin.sessions.find((s) => s.id === id);
          if (!session || session.end) return;
          const durationEl = row.querySelector<HTMLElement>(".session-duration");
          if (durationEl) {
            durationEl.textContent = formatDuration(
              Date.now() - new Date(session.start).getTime(),
            );
          }
        });
      }, 1000);
    }
  }

  private renderRow(container: HTMLElement, session: Session): void {
    const isActive = !session.end;

    const row = container.createDiv();
    row.dataset.sessionId = session.id;
    row.dataset.active = isActive ? "true" : "false";
    row.style.cssText =
      "display:flex;align-items:center;gap:8px;padding:5px 0;" +
      "border-bottom:1px solid var(--background-modifier-border-hover)";

    // Active indicator dot
    const dot = row.createSpan();
    dot.style.cssText =
      `width:7px;height:7px;border-radius:50%;flex-shrink:0;` +
      `background:${isActive ? "var(--color-green)" : "var(--background-modifier-border)"}`;

    // Project / task label + start time
    const info = row.createDiv();
    info.style.cssText = "flex:1;min-width:0";
    const project = session.project.replace(/^\[\[|\]\]$/g, "");
    const label = info.createEl("div", { text: `${project} / ${session.task}` });
    label.style.cssText =
      "overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:0.85em";
    const startTime = new Date(session.start).toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });
    const timeEl = info.createEl("div", { text: startTime });
    timeEl.style.cssText = "font-size:0.75em;color:var(--text-muted);margin-top:1px";

    // Duration
    const durationEl = row.createSpan({ cls: "session-duration" });
    durationEl.style.cssText =
      "font-size:0.78em;color:var(--text-muted);flex-shrink:0";
    if (isActive) {
      durationEl.textContent = formatDuration(
        Date.now() - new Date(session.start).getTime(),
      );
    } else {
      const elapsed =
        new Date(session.end!).getTime() - new Date(session.start).getTime();
      durationEl.textContent = formatDuration(elapsed);
    }

    // Stop button (active sessions only)
    if (isActive) {
      const stopBtn = row.createEl("button");
      stopBtn.textContent = "■";
      stopBtn.style.cssText =
        "background:none;border:none;cursor:pointer;padding:2px 4px;" +
        "font-size:0.85em;flex-shrink:0;color:var(--color-red)";
      stopBtn.addEventListener("click", () => void this.plugin.stopSession(session.id));
    }

    // Edit button
    const editBtn = row.createEl("button");
    editBtn.textContent = "✏";
    editBtn.style.cssText =
      "background:none;border:none;cursor:pointer;padding:2px 4px;" +
      "font-size:0.85em;flex-shrink:0;color:var(--text-muted)";
    editBtn.addEventListener("click", () =>
      new EditSessionModal(this.plugin, session).open(),
    );
  }
}
