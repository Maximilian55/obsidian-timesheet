import type TimesheetPlugin from "./main";
import { Session, formatDuration } from "./types";

// ── Config ────────────────────────────────────────────────────────────────────

type GroupBy = "task" | "week" | "week+task";

interface ReportConfig {
  project: string | null;
  group: GroupBy;
  period: string;
}

function parseConfig(source: string): ReportConfig {
  const config: ReportConfig = { project: null, group: "task", period: "all" };
  for (const line of source.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const colon = trimmed.indexOf(":");
    if (colon === -1) continue;
    const key = trimmed.slice(0, colon).trim().toLowerCase();
    const value = trimmed.slice(colon + 1).trim();
    if (key === "project") config.project = value;
    else if (key === "group") config.group = value as GroupBy;
    else if (key === "period") config.period = value;
  }
  return config;
}

// ── Period ────────────────────────────────────────────────────────────────────

function periodCutoff(period: string): Date | null {
  const now = new Date();
  switch (period) {
    case "last-week":     return new Date(now.getTime() - 7  * 86_400_000);
    case "last-2-weeks":  return new Date(now.getTime() - 14 * 86_400_000);
    case "last-4-weeks":  return new Date(now.getTime() - 28 * 86_400_000);
    case "this-week": {
      const d = new Date(now);
      d.setDate(d.getDate() - (d.getDay() + 6) % 7); // back to Monday
      d.setHours(0, 0, 0, 0);
      return d;
    }
    case "this-month":
      return new Date(now.getFullYear(), now.getMonth(), 1);
    default:
      return null; // "all"
  }
}

// ── ISO week helpers ──────────────────────────────────────────────────────────

function isoWeekKey(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
  const jan4 = new Date(d.getFullYear(), 0, 4);
  const n =
    1 +
    Math.round(
      ((d.getTime() - jan4.getTime()) / 86_400_000 -
        3 +
        (jan4.getDay() + 6) % 7) /
        7,
    );
  return `${d.getFullYear()}-W${String(n).padStart(2, "0")}`;
}

function weekLabel(key: string): string {
  const [yearStr, weekStr] = key.split("-W");
  const year = parseInt(yearStr, 10);
  const week = parseInt(weekStr, 10);
  const jan4 = new Date(year, 0, 4);
  const monday = new Date(jan4);
  monday.setDate(jan4.getDate() - (jan4.getDay() + 6) % 7 + (week - 1) * 7);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fmt = (d: Date): string =>
    d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `${fmt(monday)} – ${fmt(sunday)}`;
}

// ── Session helpers ───────────────────────────────────────────────────────────

function durationMs(session: Session): number {
  if (!session.start) return 0;
  const start = new Date(session.start).getTime();
  const end = session.end ? new Date(session.end).getTime() : Date.now();
  return Math.max(0, end - start);
}

function filterSessions(sessions: Session[], config: ReportConfig): Session[] {
  const cutoff = periodCutoff(config.period);
  return sessions.filter((s) => {
    if (!s.start) return false;
    if (config.project) {
      const proj = s.project.replace(/^\[\[|\]\]$/g, "").toLowerCase();
      const query = config.project.replace(/^\[\[|\]\]$/g, "").toLowerCase();
      if (proj !== query) return false;
    }
    if (cutoff && new Date(s.start) < cutoff) return false;
    return true;
  });
}

// ── Rendering helpers ─────────────────────────────────────────────────────────

function renderNoData(el: HTMLElement): void {
  const p = el.createEl("p", { text: "No sessions found for this query." });
  p.style.color = "var(--text-muted)";
  p.style.fontSize = "0.9em";
}

function renderTable(
  el: HTMLElement,
  col1Header: string,
  rows: { label: string; ms: number }[],
  totalMs: number,
): void {
  const table = el.createEl("table");
  table.style.cssText = "width:100%;border-collapse:collapse;font-size:0.9em;margin-bottom:8px";

  const cellStyle = (right = false, bold = false, border = "1px solid var(--background-modifier-border-hover)"): string =>
    `padding:4px 8px;border-bottom:${border};` +
    (right ? "text-align:right;font-variant-numeric:tabular-nums;" : "") +
    (bold ? "font-weight:bold;" : "");

  // Header
  const thead = table.createEl("thead");
  const hr = thead.createEl("tr");
  hr.createEl("th", { text: col1Header }).style.cssText =
    cellStyle(false, false, "2px solid var(--background-modifier-border)") + "color:var(--text-muted)";
  hr.createEl("th", { text: "Duration" }).style.cssText =
    cellStyle(true, false, "2px solid var(--background-modifier-border)") + "color:var(--text-muted)";

  // Body
  const tbody = table.createEl("tbody");
  for (const { label, ms } of rows) {
    const tr = tbody.createEl("tr");
    tr.createEl("td", { text: label }).style.cssText = cellStyle();
    tr.createEl("td", { text: formatDuration(ms) }).style.cssText = cellStyle(true);
  }

  // Total
  const tfoot = table.createEl("tfoot");
  const tr = tfoot.createEl("tr");
  const topBorder = "2px solid var(--background-modifier-border)";
  tr.createEl("td", { text: "Total" }).style.cssText = cellStyle(false, true, topBorder);
  tr.createEl("td", { text: formatDuration(totalMs) }).style.cssText = cellStyle(true, true, topBorder);
}

// ── Group renderers ───────────────────────────────────────────────────────────

function renderByTask(el: HTMLElement, sessions: Session[]): void {
  const map = new Map<string, number>();
  for (const s of sessions) {
    map.set(s.task, (map.get(s.task) ?? 0) + durationMs(s));
  }
  if (map.size === 0) { renderNoData(el); return; }

  const rows = [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([label, ms]) => ({ label, ms }));
  renderTable(el, "Task", rows, rows.reduce((s, r) => s + r.ms, 0));
}

function renderByWeek(el: HTMLElement, sessions: Session[]): void {
  const map = new Map<string, number>();
  for (const s of sessions) {
    const key = isoWeekKey(new Date(s.start));
    map.set(key, (map.get(key) ?? 0) + durationMs(s));
  }
  if (map.size === 0) { renderNoData(el); return; }

  const rows = [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, ms]) => ({ label: weekLabel(key), ms }));
  renderTable(el, "Week", rows, rows.reduce((s, r) => s + r.ms, 0));
}

function renderByWeekTask(el: HTMLElement, sessions: Session[]): void {
  const byWeek = new Map<string, Map<string, number>>();
  for (const s of sessions) {
    const key = isoWeekKey(new Date(s.start));
    if (!byWeek.has(key)) byWeek.set(key, new Map());
    const taskMap = byWeek.get(key)!;
    taskMap.set(s.task, (taskMap.get(s.task) ?? 0) + durationMs(s));
  }
  if (byWeek.size === 0) { renderNoData(el); return; }

  let grandTotal = 0;
  for (const [key, taskMap] of [...byWeek.entries()].sort((a, b) =>
    a[0].localeCompare(b[0]),
  )) {
    const heading = el.createEl("p", { text: weekLabel(key) });
    heading.style.cssText =
      "margin:12px 0 4px;font-weight:bold;font-size:0.85em;color:var(--text-muted)";

    const rows = [...taskMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([label, ms]) => ({ label, ms }));
    const weekTotal = rows.reduce((s, r) => s + r.ms, 0);
    grandTotal += weekTotal;
    renderTable(el, "Task", rows, weekTotal);
  }

  const p = el.createEl("p", { text: `Grand total: ${formatDuration(grandTotal)}` });
  p.style.cssText = "margin-top:8px;font-weight:bold;text-align:right;font-size:0.9em";
}

// ── Registration ──────────────────────────────────────────────────────────────

export function registerReporter(plugin: TimesheetPlugin): void {
  plugin.registerMarkdownCodeBlockProcessor("timesheet", (source, el, ctx) => {
    const config = parseConfig(source);

    // Default project to the current file's basename if not explicitly set
    if (!config.project) {
      const basename = ctx.sourcePath.split("/").pop()?.replace(/\.md$/, "") ?? "";
      if (basename) config.project = `[[${basename}]]`;
    }

    const sessions = filterSessions(plugin.sessions, config);

    if (config.group === "task") renderByTask(el, sessions);
    else if (config.group === "week") renderByWeek(el, sessions);
    else if (config.group === "week+task") renderByWeekTask(el, sessions);
    else {
      const p = el.createEl("p", {
        text: `Timesheet: unknown group "${config.group}". Use: task, week, or week+task.`,
      });
      p.style.color = "var(--text-error)";
    }
  });
}
