export type ReminderCandidate = {
  id: string;
  task: string;
  owner: string;
  deadline: string;
  status: string;
  userId: string;
  userEmail: string;
  ownerEmail?: string | null;
  lastReminderSent: Date | null;
};

export function parseActionDeadline(value: string): Date | null {
  const text = value.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (iso) {
    return new Date(Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])));
  }

  const vietnamese = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
  if (vietnamese) {
    return new Date(
      Date.UTC(Number(vietnamese[3]), Number(vietnamese[2]) - 1, Number(vietnamese[1])),
    );
  }

  return null;
}

export function shouldSendDeadlineReminder({
  deadline,
  status,
  lastReminderSent,
  now = new Date(),
}: {
  deadline: string;
  status: string;
  lastReminderSent: Date | null;
  now?: Date;
}) {
  if (status === "done") return false;
  if (wasReminderSentWithin24Hours(lastReminderSent, now)) return false;

  const parsed = parseActionDeadline(deadline);
  if (!parsed) return false;

  const today = startOfUtcDay(now);
  const twoDaysFromNow = addUtcDays(today, 2);
  return parsed.getTime() <= twoDaysFromNow.getTime();
}

export function groupReminderCandidatesByEmail(
  candidates: ReminderCandidate[],
  now = new Date(),
) {
  const groups = new Map<string, ReminderCandidate[]>();

  for (const candidate of candidates) {
    if (!shouldSendDeadlineReminder({ ...candidate, now })) continue;
    const email = candidate.ownerEmail || extractEmail(candidate.owner) || candidate.userEmail;
    const items = groups.get(email) || [];
    items.push(candidate);
    groups.set(email, items);
  }

  return groups;
}

function wasReminderSentWithin24Hours(value: Date | null, now: Date) {
  if (!value) return false;
  return now.getTime() - value.getTime() < 24 * 60 * 60 * 1000;
}

function startOfUtcDay(value: Date) {
  return new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
  );
}

function addUtcDays(value: Date, days: number) {
  return new Date(value.getTime() + days * 24 * 60 * 60 * 1000);
}

function extractEmail(value: string) {
  return value.match(/[^\s<>,;]+@[^\s<>,;]+\.[^\s<>,;]+/)?.[0] ?? null;
}
