import type { FirebaseUser, MealEntry, MenuGroup, MenuParticipant, UserProfile } from './types';

type ParticipantLabels = Record<string, string>;

export function getParticipantDisplayName(participant: MenuParticipant) {
  return participant.name || participant.email || participant.id;
}

export function getParticipantInitials(participant: MenuParticipant) {
  const name = getParticipantDisplayName(participant);
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase() ?? '')
    .join('');

  return initials || '?';
}

export function getMenuParticipants(
  group: MenuGroup | null | undefined,
  user: FirebaseUser | null | undefined,
  profile: UserProfile | null | undefined,
  guestLabel = ''
): MenuParticipant[] {
  const currentUserName = profile?.displayName || user?.displayName || user?.email || guestLabel;

  if (!group?.members?.length) {
    return user ? [{ id: user.uid, name: currentUserName, email: profile?.email || user.email || '' }] : [];
  }

  return group.members.map((id, index) => {
    const email = group.memberEmails[index] ?? '';
    return {
      id,
      name: id === user?.uid ? currentUserName : '',
      email,
    };
  });
}

export function getSelectedParticipantIds(meal: Pick<MealEntry, 'participantIds'>, participants: MenuParticipant[]) {
  if (!participants.length) return [];
  if (!Array.isArray(meal.participantIds)) return participants.map((participant) => participant.id);

  const allowedIds = new Set(participants.map((participant) => participant.id));
  return [...new Set(meal.participantIds.filter((id) => allowedIds.has(id)))];
}

export function getStoredParticipantIds(selectedIds: string[], participants: MenuParticipant[]) {
  if (!participants.length) return undefined;

  const allowedIds = new Set(participants.map((participant) => participant.id));
  const cleanIds = [...new Set(selectedIds.filter((id) => allowedIds.has(id)))];

  return cleanIds.length === allowedIds.size ? undefined : cleanIds;
}

export function getSelectedParticipants(meal: Pick<MealEntry, 'participantIds'>, participants: MenuParticipant[]) {
  const selectedIds = new Set(getSelectedParticipantIds(meal, participants));
  return participants.filter((participant) => selectedIds.has(participant.id));
}

export function formatParticipantSummary(
  meal: Pick<MealEntry, 'participantIds'>,
  participants: MenuParticipant[],
  labels: ParticipantLabels
) {
  const allLabel = labels.participantsAll ?? labels.statusAll ?? 'Todos';
  if (!participants.length || !Array.isArray(meal.participantIds)) return allLabel;

  const selected = getSelectedParticipants(meal, participants);
  if (selected.length === participants.length) return allLabel;
  if (!selected.length) return '0';

  const visibleNames = selected.slice(0, 2).map(getParticipantDisplayName).join(', ');
  const extraCount = selected.length - 2;

  return extraCount > 0 ? `${visibleNames} +${extraCount}` : visibleNames;
}
