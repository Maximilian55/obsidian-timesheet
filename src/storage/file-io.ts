import { App, TFile } from "obsidian";

function getParentFolders(path: string): string[] {
  const normalized = path.replace(/\\/g, "/");
  const parts = normalized.split("/");
  parts.pop();

  const folders: string[] = [];
  for (let i = 0; i < parts.length; i += 1) {
    const folder = parts.slice(0, i + 1).join("/");
    if (folder.length > 0) {
      folders.push(folder);
    }
  }

  return folders;
}

async function ensureParentFolders(app: App, path: string): Promise<void> {
  for (const folder of getParentFolders(path)) {
    const existing = app.vault.getAbstractFileByPath(folder);
    if (!existing) {
      await app.vault.createFolder(folder);
    }
  }
}

export async function ensureFile(app: App, path: string): Promise<TFile> {
  const existing = app.vault.getAbstractFileByPath(path);
  if (existing instanceof TFile) {
    return existing;
  }

  await ensureParentFolders(app, path);
  return app.vault.create(path, "");
}

export async function readTextFile(app: App, path: string): Promise<string | null> {
  const existing = app.vault.getAbstractFileByPath(path);
  if (!(existing instanceof TFile)) {
    return null;
  }

  return app.vault.read(existing);
}

export async function writeTextFile(app: App, path: string, content: string): Promise<void> {
  const file = await ensureFile(app, path);
  await app.vault.modify(file, content);
}
