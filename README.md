# Obsidian Timesheet

Track time sessions by project, view live timers in the status bar and sidebar, and embed reports directly in your notes.

## Commands

| Command | Description |
|---|---|
| `Timesheet: Start Task` | Pick a project and task name to begin a session |
| `Timesheet: Stop Task` | Stop one active session |
| `Timesheet: Stop All Tasks` | Stop all running sessions at once |
| `Timesheet: Open Timesheet` | Open the sidebar panel |

## Sidebar

The sidebar panel (clock icon) lists all sessions grouped by date. Each row shows the project, task, start time, and elapsed duration. Active sessions have a green dot and a live running clock.

- **■** — stop the session inline
- **✏** — open the edit modal to change start/end time, project, task, or delete the session

## Status Bar

While sessions are running the status bar shows all active sessions and their elapsed time, updated every second:

```
My Project / Feature work • 1h 4m  |  Other Project / Meeting • 23m
```

## Reports

Embed a `timesheet` code block anywhere in your vault to render aggregated data as a table.

~~~markdown
```timesheet
group: task
```
~~~

When no `project` is specified the block automatically uses the current file's name as the project — so placing this on `My Project.md` reports on `[[My Project]]` with no extra config.

### Options

**`project`** — filter to a specific project. Defaults to the current file name.

```
project: [[My Project]]
```

**`group`** — how to aggregate the data. Required.

| Value | Output |
|---|---|
| `task` | One table sorted by time spent per task |
| `week` | One table with a row per calendar week |
| `week+task` | A table per week showing the task breakdown, plus a grand total |

**`period`** — limit sessions to a time window. Defaults to `all`.

| Value | Description |
|---|---|
| `last-week` | Past 7 days |
| `last-2-weeks` | Past 14 days |
| `last-4-weeks` | Past 28 days |
| `this-week` | Monday of the current week to now |
| `this-month` | First of the current month to now |
| `all` | No time filter (default) |

### Examples

Task breakdown for the current project, all time:

~~~markdown
```timesheet
group: task
```
~~~

Weekly totals for the past month:

~~~markdown
```timesheet
group: week
period: last-4-weeks
```
~~~

Full breakdown by week and task for a specific project:

~~~markdown
```timesheet
project: [[My Project]]
group: week+task
period: last-4-weeks
```
~~~

Active sessions are included in all reports and counted up to the current time.

## Data

Sessions are stored as a flat JSON array at `Timesheets/timesheet-data.json` in your vault. The file is human-readable and can be edited directly.

```json
[
  {
    "id": "1705312800000-123456",
    "project": "[[My Project]]",
    "task": "Feature work",
    "start": "2024-01-15T09:00:00.000Z",
    "end": "2024-01-15T10:30:00.000Z"
  }
]
```

## Settings

| Setting | Description | Default |
|---|---|---|
| Project notes folder | Only notes in this folder appear in the project picker | `notes/projects` |

## Build

```
npm install
npm run build
```

Copy `main.js` and `manifest.json` to `<Vault>/.obsidian/plugins/obsidian-timesheet/`, then enable the plugin in Settings → Community plugins.
