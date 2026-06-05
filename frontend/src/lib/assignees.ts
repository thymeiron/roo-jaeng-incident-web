export const ASSIGNEES = ["Thyme", "Tun", "Champ"] as const;

export type Assignee = (typeof ASSIGNEES)[number];

export function normalizeAssignedTo(value?: string | null) {
  if (!value || value.trim() === "" || value.trim() === "-") {
    return "Unassigned";
  }

  const text = value.trim();
  const lower = text.toLowerCase();

  if (lower === "thyme" || lower === "na nakorn thyme") return "Thyme";
  if (lower === "tun") return "Tun";
  if (lower === "champ") return "Champ";

  return "Unassigned";
}
