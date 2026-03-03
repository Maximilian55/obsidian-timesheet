export interface Session {
  id: string;
  project: string; // wikilink e.g. [[My Project]]
  task: string;
  start: string;  // ISO 8601
  end?: string;   // ISO 8601, absent = still running
}

export interface Store {
  sessions: Session[];
}

export function formatDuration(ms: number): string {
  if (ms < 0) ms = 0;
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${seconds}s`;
}
