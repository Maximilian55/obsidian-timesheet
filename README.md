# Obsidian Timesheet

Minimal Obsidian plugin for tracking task sessions by project link.
Current codebase is very much "vibe-coded"
Still need to go through and trim the fat from AI

## Commands
- `Timesheet: Start Task`
- `Timesheet: Stop Task`
- `Timesheet: Stop All Tasks`

## Build
1. Install dependencies: `npm install`
2. Build plugin: `npm run build`

This generates `main.js` in the plugin root.

## Test In Obsidian
1. Put this folder at `<Vault>/.obsidian/plugins/obsidian-timesheet`
2. Run `npm install`
3. Run `npm run build`
4. In Obsidian: Settings -> Community plugins -> Reload plugins
5. Enable `Timesheet`

## Data Output
- Canonical session data is stored in vault JSON at `Timesheets/timesheet-data.json` (configurable in settings).
- Plugin settings are stored in Obsidian plugin data.

## To Do
- Trim fat from AI
- Add some display to status bar that shows active sessions
- remove prefix project folder path from UI when selecting the project that the session is for