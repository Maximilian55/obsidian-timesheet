import { App, TFile } from "obsidian";

export async function ensureFile(app: App, path: string): Promise<TFile> {
  const existing = app.vault.getAbstractFileByPath(path);
  if (existing instanceof TFile) {
    return existing;
  }

  return app.vault.create(path, "");
}

export async function writeTextFile(app: App, path: string, content: string): Promise<void> {
  const file = await ensureFile(app, path);
  await app.vault.modify(file, content);
}
