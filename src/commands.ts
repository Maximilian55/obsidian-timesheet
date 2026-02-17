import { App, Modal, Notice, SuggestModal, TFile } from "obsidian";
import type TimesheetPlugin from "./main";
import { normalizeProjectInput, validateProject, validateTask } from "./tracker/validators";

interface StartTaskInput {
  project: string;
  task: string;
}

function normalizeFolderPrefix(folder: string): string {
  return folder.trim().replace(/^\/+|\/+$/g, "").toLowerCase();
}

function openProjectPickerModal(app: App, folderFilter: string): Promise<string | null> {
  return new Promise((resolve) => {
    class ProjectPickerModal extends SuggestModal<TFile> {
      private resolved = false;
      private readonly items: TFile[];

      constructor() {
        super(app);
        const prefix = normalizeFolderPrefix(folderFilter);
        const allNotes = app.vault.getMarkdownFiles();
        this.items = !prefix
          ? allNotes
          : allNotes.filter((file) => {
              const path = file.path.toLowerCase();
              return path.startsWith(`${prefix}/`) || path === `${prefix}.md`;
            });
      }

      getItems(): TFile[] {
        return this.items;
      }

      getSuggestions(query: string): TFile[] {
        const normalized = query.toLowerCase().trim();
        if (!normalized) {
          return this.items;
        }

        return this.items.filter((item) => {
          const path = item.path.toLowerCase();
          const base = item.basename.toLowerCase();
          return path.includes(normalized) || base.includes(normalized);
        });
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
        // Selection is resolved in selectSuggestion to avoid close-order race issues.
      }

      onClose(): void {
        super.onClose();
        if (!this.resolved) {
          resolve(null);
        }
      }
    }

    const modal = new ProjectPickerModal();
    modal.setPlaceholder("Select a project note");
    modal.open();
  });
}

function openStartTaskModal(app: App, projectNotesFolder: string): Promise<StartTaskInput | null> {
  return new Promise((resolve) => {
    class StartTaskModal extends Modal {
      private resolved = false;

      onOpen(): void {
        const { contentEl } = this;
        contentEl.empty();

        contentEl.createEl("h3", { text: "Start Task" });

        const projectLabel = contentEl.createEl("label", { text: "Project:" });
        projectLabel.style.display = "block";

        const projectRow = contentEl.createDiv();
        projectRow.style.display = "flex";
        projectRow.style.gap = "8px";

        const projectInput = projectRow.createEl("input", { type: "text" });
        projectInput.style.width = "100%";
        projectInput.readOnly = true;

        const chooseButton = projectRow.createEl("button", { text: "Choose" });

        const taskLabel = contentEl.createEl("label", { text: "Task:" });
        taskLabel.style.display = "block";
        taskLabel.style.marginTop = "8px";
        const taskInput = contentEl.createEl("input", { type: "text" });
        taskInput.style.width = "100%";

        const buttonRow = contentEl.createDiv();
        buttonRow.style.display = "flex";
        buttonRow.style.gap = "8px";
        buttonRow.style.marginTop = "12px";

        const startButton = buttonRow.createEl("button", { text: "Start" });
        const cancelButton = buttonRow.createEl("button", { text: "Cancel" });

        const chooseProject = async (): Promise<void> => {
          const project = await openProjectPickerModal(app, projectNotesFolder);
          if (project) {
            projectInput.value = project;
            taskInput.focus();
          }
        };

        const submit = (): void => {
          const project = projectInput.value.trim();
          const task = taskInput.value.trim();
          this.resolved = true;
          resolve({ project, task });
          this.close();
        };

        startButton.addEventListener("click", submit);
        cancelButton.addEventListener("click", () => {
          this.resolved = true;
          resolve(null);
          this.close();
        });
        chooseButton.addEventListener("click", () => {
          void chooseProject();
        });

        taskInput.addEventListener("keydown", (event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            submit();
          }
        });

        taskInput.focus();
        void chooseProject();
      }

      onClose(): void {
        this.contentEl.empty();
        if (!this.resolved) {
          resolve(null);
        }
      }
    }

    new StartTaskModal(app).open();
  });
}

function openStopSelectionModal(app: App, options: string[]): Promise<number | null> {
  return new Promise((resolve) => {
    class StopTaskModal extends Modal {
      private resolved = false;
      private selectedIndex = 0;
      private optionButtons: HTMLButtonElement[] = [];

      onOpen(): void {
        const { contentEl } = this;
        contentEl.empty();

        contentEl.createEl("h3", { text: "Stop Task" });
        contentEl.createEl("p", { text: "Choose an active task:" });

        const list = contentEl.createDiv();
        list.style.display = "flex";
        list.style.flexDirection = "column";
        list.style.gap = "8px";

        const setSelectedIndex = (index: number): void => {
          if (this.optionButtons.length === 0) {
            this.selectedIndex = 0;
            return;
          }

          const normalized = ((index % this.optionButtons.length) + this.optionButtons.length) % this.optionButtons.length;
          this.selectedIndex = normalized;

          this.optionButtons.forEach((button, buttonIndex) => {
            const isSelected = buttonIndex === this.selectedIndex;
            button.toggleClass("is-selected", isSelected);
            if (isSelected) {
              button.focus();
            }
          });
        };

        const chooseSelected = (): void => {
          if (this.optionButtons.length === 0) {
            return;
          }

          this.resolved = true;
          resolve(this.selectedIndex);
          this.close();
        };

        options.forEach((label, index) => {
          const button = list.createEl("button", { text: label });
          button.style.textAlign = "left";
          this.optionButtons.push(button);
          button.addEventListener("click", () => {
            this.resolved = true;
            resolve(index);
            this.close();
          });
        });

        const cancelButton = contentEl.createEl("button", { text: "Cancel" });
        cancelButton.style.marginTop = "12px";
        cancelButton.addEventListener("click", () => {
          this.resolved = true;
          resolve(null);
          this.close();
        });

        this.scope.register([], "ArrowDown", (event) => {
          event.preventDefault();
          setSelectedIndex(this.selectedIndex + 1);
        });

        this.scope.register([], "ArrowUp", (event) => {
          event.preventDefault();
          setSelectedIndex(this.selectedIndex - 1);
        });

        this.scope.register([], "Enter", (event) => {
          event.preventDefault();
          chooseSelected();
        });

        this.scope.register([], "Escape", (event) => {
          event.preventDefault();
          this.resolved = true;
          resolve(null);
          this.close();
        });

        setSelectedIndex(0);
      }

      onClose(): void {
        this.contentEl.empty();
        if (!this.resolved) {
          resolve(null);
        }
      }
    }

    new StopTaskModal(app).open();
  });
}

export function registerCommands(plugin: TimesheetPlugin): void {
  plugin.addCommand({
    id: "timesheet-start-task",
    name: "Timesheet: Start Task",
    callback: async () => {
      try {
        const input = await openStartTaskModal(plugin.app, plugin.settings.projectNotesFolder);
        if (!input) {
          return;
        }

        const project = normalizeProjectInput(input.project);
        const projectError = validateProject(project);
        if (projectError) {
          new Notice(projectError);
          return;
        }

        const task = input.task.trim();
        const taskError = validateTask(task);
        if (taskError) {
          new Notice(taskError);
          return;
        }

        const session = await plugin.sessionManager.startSession(project, task);
        new Notice(`Started: ${session.project} - ${session.task}`);
      } catch (error) {
        new Notice(`Start failed: ${String(error)}`);
      }
    },
  });

  plugin.addCommand({
    id: "timesheet-stop-task",
    name: "Timesheet: Stop Task",
    callback: async () => {
      try {
        const active = plugin.sessionManager.getActiveSessions();
        if (active.length === 0) {
          new Notice("No active tasks.");
          return;
        }

        let selected = active[0];

        if (active.length > 1) {
          const labels = active.map((session) => `${session.project} - ${session.task}`);
          const index = await openStopSelectionModal(plugin.app, labels);
          if (index === null || index < 0 || index >= active.length) {
            new Notice("Task stop canceled.");
            return;
          }

          selected = active[index];
        }

        const stopped = await plugin.sessionManager.stopSession(selected.id);
        if (!stopped) {
          new Notice("Could not stop task.");
          return;
        }

        new Notice(`Stopped: ${stopped.project} - ${stopped.task}`);
      } catch (error) {
        new Notice(`Stop failed: ${String(error)}`);
      }
    },
  });

  plugin.addCommand({
    id: "timesheet-stop-all",
    name: "Timesheet: Stop All Tasks",
    callback: async () => {
      try {
        const count = await plugin.sessionManager.stopAllSessions();
        if (count === 0) {
          new Notice("No active tasks.");
          return;
        }

        new Notice(`Stopped ${count} task(s).`);
      } catch (error) {
        new Notice(`Stop all failed: ${String(error)}`);
      }
    },
  });
}
