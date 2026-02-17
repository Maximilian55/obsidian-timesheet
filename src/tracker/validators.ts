const WIKILINK_PATTERN = /^\[\[[^\]]+\]\]$/;

export function normalizeProjectInput(projectInput: string): string {
  const trimmed = projectInput.trim();

  if (WIKILINK_PATTERN.test(trimmed)) {
    return trimmed;
  }

  return `[[${trimmed}]]`;
}

export function validateProject(projectLink: string): string | null {
  if (!projectLink.trim()) {
    return "Project is required.";
  }

  if (!WIKILINK_PATTERN.test(projectLink)) {
    return "Project must be a wiki link like [[Project Name]].";
  }

  return null;
}

export function validateTask(task: string): string | null {
  if (!task.trim()) {
    return "Task is required.";
  }

  return null;
}
