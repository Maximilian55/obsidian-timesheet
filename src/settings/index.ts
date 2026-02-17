import { PluginSettingTab, Setting } from "obsidian";
import type TimesheetPlugin from "../main";
import { TimesheetPluginSettings } from "../types";

export function getDefaultSettings(): TimesheetPluginSettings {
  return {
    timesheetJsonPath: "Timesheets/timesheet-data.json",
    projectNotesFolder: "notes/projects",
  };
}

export class SettingsTab extends PluginSettingTab {
  private plugin: TimesheetPlugin;

  constructor(plugin: TimesheetPlugin) {
    super(plugin.app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "Timesheet" });

    new Setting(containerEl)
      .setName("Timesheet JSON path")
      .setDesc("Vault path for canonical timesheet JSON storage.")
      .addText((text) => {
        text
          .setPlaceholder("Timesheets/timesheet-data.json")
          .setValue(this.plugin.settings.timesheetJsonPath)
          .onChange(async (value) => {
            const trimmed = value.trim();
            await this.plugin.updateSettings({
              timesheetJsonPath: trimmed.length > 0 ? trimmed : "Timesheets/timesheet-data.json",
            });
          });
      });

    new Setting(containerEl)
      .setName("Project notes folder")
      .setDesc("Only notes in this folder appear in project picker.")
      .addText((text) => {
        text
          .setPlaceholder("notes/projects")
          .setValue(this.plugin.settings.projectNotesFolder)
          .onChange(async (value) => {
            await this.plugin.updateSettings({
              projectNotesFolder: value.trim(),
            });
          });
      });
  }
}
