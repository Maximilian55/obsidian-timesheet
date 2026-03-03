import { Modal, Notice, SuggestModal, TFile } from "obsidian";
import type TimesheetPlugin from "./main";
import { Session } from "./types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalizeFolderPrefix(folder: string): string {
  return folder.trim().replace(/^\/+|\/+$/g, "").toLowerCase();
}

function toDatetimeLocalValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

function fromDatetimeLocalValue(value: string): string {
  return new Date(value).toISOString();
}

// ── Project picker (internal helper) ─────────────────────────────────────────

function openProjectPickerModal(
  plugin: TimesheetPlugin,
  folderFilter: string,
): Promise<string | null> {
  return new Promise((resolve) => {
    class ProjectPickerModal extends SuggestModal<TFile> {
      private resolved = false;
      private readonly items: TFile[];

      constructor() {
        super(plugin.app);
        const prefix = normalizeFolderPrefix(folderFilter);
        const all = plugin.app.vault.getMarkdownFiles();
        this.items = !prefix
          ? all
          : all.filter((f) => {
              const p = f.path.toLowerCase();
              return p.startsWith(`${prefix}/`) || p === `${prefix}.md`;
            });
      }

      getSuggestions(query: string): TFile[] {
        const q = query.toLowerCase().trim();
        if (!q) return this.items;
        return this.items.filter(
          (f) =>
            f.path.toLowerCase().includes(q) ||
            f.basename.toLowerCase().includes(q),
        );
      }

      renderSuggestion(item: TFile, el: HTMLElement): void {
        el.setText(item.path);
      }

      selectSuggestion(item: TFile, evt: MouseEvent | KeyboardEvent): void {
        this.resolved = true;
        resolve(`[[${item.basename}]]`);
        super.selectSuggestion(item, evt);
      }

      onChooseSuggestion(_item: TFile, _evt: MouseEvent | KeyboardEvent): void {
        // handled in selectSuggestion
      }

      onClose(): void {
        super.onClose();
        if (!this.resolved) resolve(null);
      }
    }

    const m = new ProjectPickerModal();
    m.setPlaceholder("Select a project note");
    m.open();
  });
}

// ── Task suggestions picker (internal helper) ─────────────────────────────────

function openTaskSuggestModal(
  plugin: TimesheetPlugin,
  tasks: string[],
): Promise<string | null> {
  return new Promise((resolve) => {
    class TaskSuggestModal extends SuggestModal<string> {
      private resolved = false;

      getSuggestions(query: string): string[] {
        const q = query.toLowerCase().trim();
        if (!q) return tasks;
        return tasks.filter((t) => t.toLowerCase().includes(q));
      }

      renderSuggestion(item: string, el: HTMLElement): void {
        el.setText(item);
      }

      selectSuggestion(item: string, evt: MouseEvent | KeyboardEvent): void {
        this.resolved = true;
        resolve(item);
        super.selectSuggestion(item, evt);
      }

      onChooseSuggestion(_item: string, _evt: MouseEvent | KeyboardEvent): void {
        // handled in selectSuggestion
      }

      onClose(): void {
        super.onClose();
        if (!this.resolved) resolve(null);
      }
    }

    const m = new TaskSuggestModal(plugin.app);
    m.setPlaceholder("Select a task");
    m.open();
  });
}

// ── StartModal ────────────────────────────────────────────────────────────────

export class StartModal extends Modal {
  private readonly plugin: TimesheetPlugin;

  constructor(plugin: TimesheetPlugin) {
    super(plugin.app);
    this.plugin = plugin;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h3", { text: "Start Task" });

    // Project row
    const projectLabel = contentEl.createEl("label", { text: "Project:" });
    projectLabel.style.display = "block";

    const projectRow = contentEl.createDiv();
    projectRow.style.cssText = "display:flex;gap:8px;align-items:center";
    const projectInput = projectRow.createEl("input", { type: "text" });
    projectInput.style.flex = "1";
    projectInput.readOnly = true;
    const chooseProjectBtn = projectRow.createEl("button", { text: "Choose" });

    // Task row
    const taskLabel = contentEl.createEl("label", { text: "Task:" });
    taskLabel.style.cssText = "display:block;margin-top:8px";
    const taskRow = contentEl.createDiv();
    taskRow.style.cssText = "display:flex;gap:8px;align-items:center";
    const taskInput = taskRow.createEl("input", { type: "text" });
    taskInput.style.flex = "1";
    const suggestTaskBtn = taskRow.createEl("button", { text: "Suggest" });

    // Action buttons
    const btnRow = contentEl.createDiv();
    btnRow.style.cssText = "display:flex;gap:8px;margin-top:12px";
    const startBtn = btnRow.createEl("button", { text: "Start" });
    const cancelBtn = btnRow.createEl("button", { text: "Cancel" });

    const chooseProject = async (): Promise<void> => {
      const project = await openProjectPickerModal(
        this.plugin,
        this.plugin.settings.projectFolder,
      );
      if (!project) return;
      projectInput.value = project;
      const suggestions = this.plugin.getTaskSuggestions(project);
      if (suggestions.length > 0 && !taskInput.value.trim()) {
        taskInput.value = suggestions[0];
      }
      taskInput.focus();
    };

    const suggestTask = async (): Promise<void> => {
      const project = projectInput.value.trim();
      if (!project) {
        new Notice("Choose a project first.");
        return;
      }
      const suggestions = this.plugin.getTaskSuggestions(project);
      if (suggestions.length === 0) {
        new Notice("No previous tasks for this project.");
        return;
      }
      const chosen = await openTaskSuggestModal(this.plugin, suggestions);
      if (chosen) {
        taskInput.value = chosen;
        taskInput.focus();
      }
    };

    const submit = async (): Promise<void> => {
      const project = projectInput.value.trim();
      const task = taskInput.value.trim();
      if (!project) {
        new Notice("Choose a project.");
        return;
      }
      if (!task) {
        new Notice("Enter a task name.");
        return;
      }
      await this.plugin.startSession(project, task);
      this.close();
    };

    chooseProjectBtn.addEventListener("click", () => void chooseProject());
    suggestTaskBtn.addEventListener("click", () => void suggestTask());
    startBtn.addEventListener("click", () => void submit());
    cancelBtn.addEventListener("click", () => this.close());
    taskInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        void submit();
      }
    });

    taskInput.focus();
    void chooseProject();
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

// ── StopModal ─────────────────────────────────────────────────────────────────

export class StopModal extends Modal {
  private readonly plugin: TimesheetPlugin;

  constructor(plugin: TimesheetPlugin) {
    super(plugin.app);
    this.plugin = plugin;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h3", { text: "Stop Task" });

    const active = this.plugin.getActiveSessions();

    if (active.length === 0) {
      contentEl.createEl("p", { text: "No active tasks." });
      contentEl.createEl("button", { text: "Close" }).addEventListener("click", () => this.close());
      return;
    }

    const list = contentEl.createDiv();
    list.style.cssText = "display:flex;flex-direction:column;gap:8px";

    for (const session of active) {
      const project = session.project.replace(/^\[\[|\]\]$/g, "");
      const btn = list.createEl("button", {
        text: `${project} — ${session.task}`,
      });
      btn.style.textAlign = "left";
      btn.addEventListener("click", async () => {
        await this.plugin.stopSession(session.id);
        this.close();
      });
    }

    const cancelBtn = contentEl.createEl("button", { text: "Cancel" });
    cancelBtn.style.marginTop = "12px";
    cancelBtn.addEventListener("click", () => this.close());
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

// ── EditSessionModal ───────────────────────────────────────────────────────────

export class EditSessionModal extends Modal {
  private readonly plugin: TimesheetPlugin;
  private readonly session: Session;

  constructor(plugin: TimesheetPlugin, session: Session) {
    super(plugin.app);
    this.plugin = plugin;
    this.session = session;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h3", { text: "Edit Session" });

    const addField = (
      label: string,
      value: string,
      type = "text",
    ): HTMLInputElement => {
      const l = contentEl.createEl("label", { text: label });
      l.style.cssText = "display:block;margin-top:8px";
      const input = contentEl.createEl("input", { type });
      input.value = value;
      input.style.cssText = "display:block;width:100%;margin-top:4px";
      return input;
    };

    const projectInput = addField("Project", this.session.project);
    const taskInput = addField("Task", this.session.task);
    const startInput = addField(
      "Start",
      toDatetimeLocalValue(this.session.start),
      "datetime-local",
    );
    const endInput = addField(
      "End",
      this.session.end ? toDatetimeLocalValue(this.session.end) : "",
      "datetime-local",
    );

    if (!this.session.end) {
      endInput.placeholder = "Leave blank — still running";
    }

    const btnRow = contentEl.createDiv();
    btnRow.style.cssText = "display:flex;gap:8px;margin-top:16px";
    const saveBtn = btnRow.createEl("button", { text: "Save" });
    const deleteBtn = btnRow.createEl("button", { text: "Delete" });
    const cancelBtn = btnRow.createEl("button", { text: "Cancel" });

    saveBtn.addEventListener("click", async () => {
      const patch: Partial<Session> = {
        project: projectInput.value.trim() || this.session.project,
        task: taskInput.value.trim() || this.session.task,
        start: startInput.value
          ? fromDatetimeLocalValue(startInput.value)
          : this.session.start,
      };
      if (endInput.value.trim()) {
        patch.end = fromDatetimeLocalValue(endInput.value);
      } else {
        patch.end = undefined;
      }
      await this.plugin.editSession(this.session.id, patch);
      this.close();
    });

    deleteBtn.addEventListener("click", async () => {
      await this.plugin.deleteSession(this.session.id);
      this.close();
    });

    cancelBtn.addEventListener("click", () => this.close());
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
