import { EventRef } from "obsidian";
import type TimesheetPlugin from "./main";
import { formatDuration } from "./types";

export class StatusBarTimer {
  private readonly plugin: TimesheetPlugin;
  private readonly el: HTMLElement;
  private readonly eventRef: EventRef;
  private intervalId: number | null = null;

  constructor(plugin: TimesheetPlugin, el: HTMLElement) {
    this.plugin = plugin;
    this.el = el;
    this.eventRef = plugin.events.on("sessions-changed", () => this.refresh());
    this.refresh();
  }

  private refresh(): void {
    const active = this.plugin.getActiveSessions();

    if (active.length === 0) {
      this.el.setText("");
      this.clearInterval();
      return;
    }

    this.updateLabel();

    if (this.intervalId === null) {
      this.intervalId = window.setInterval(() => this.updateLabel(), 1000);
    }
  }

  private updateLabel(): void {
    const active = this.plugin.getActiveSessions();

    if (active.length === 0) {
      this.el.setText("");
      this.clearInterval();
      return;
    }

    const now = Date.now();
    const parts = active.map((s) => {
      const project = s.project.replace(/^\[\[|\]\]$/g, "");
      const elapsed = now - new Date(s.start).getTime();
      return `${project} / ${s.task} • ${formatDuration(elapsed)}`;
    });

    this.el.setText(parts.join("  |  "));
  }

  private clearInterval(): void {
    if (this.intervalId !== null) {
      window.clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  destroy(): void {
    this.clearInterval();
    this.plugin.events.offref(this.eventRef);
  }
}
