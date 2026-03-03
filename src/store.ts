import { App, TFile } from "obsidian";
import { Session } from "./types";

export class JsonStore {
  private readonly app: App;
  private readonly path: string;

  constructor(app: App, path: string) {
    this.app = app;
    this.path = path;
  }

  async load(): Promise<Session[]> {
    const file = this.app.vault.getAbstractFileByPath(this.path);
    if (!(file instanceof TFile)) return [];

    const content = await this.app.vault.read(file);
    if (!content.trim()) return [];

    try {
      const parsed = JSON.parse(content) as unknown;
      if (Array.isArray(parsed)) return parsed as Session[];
      // Handle legacy format where sessions were nested in an object
      if (parsed && typeof parsed === "object") {
        const obj = parsed as Record<string, unknown>;
        if (Array.isArray(obj.sessions)) return obj.sessions as Session[];
      }
      return [];
    } catch {
      return [];
    }
  }

  async save(sessions: Session[]): Promise<void> {
    const content = JSON.stringify(sessions, null, 2) + "\n";
    const existing = this.app.vault.getAbstractFileByPath(this.path);
    if (existing instanceof TFile) {
      await this.app.vault.modify(existing, content);
    } else {
      await this.ensureParentFolders();
      await this.app.vault.create(this.path, content);
    }
  }

  private async ensureParentFolders(): Promise<void> {
    const parts = this.path.split("/");
    parts.pop();
    for (let i = 1; i <= parts.length; i++) {
      const folder = parts.slice(0, i).join("/");
      if (!folder) continue;
      if (!this.app.vault.getAbstractFileByPath(folder)) {
        await this.app.vault.createFolder(folder);
      }
    }
  }
}
