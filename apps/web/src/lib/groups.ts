/**
 * Musobaqa guruhi nomi: yakka/juftlik/aralash juftlik/jamoaviy + jins.
 * `gender = null` — aralash yoki ochiq guruh (jins ko'rsatilmaydi).
 */
export type EventType = 'SINGLES' | 'DOUBLES' | 'MIXED_DOUBLES' | 'TEAM';

export function groupLabel(
  eventType: EventType,
  gender: 'MALE' | 'FEMALE' | null,
  t: (key: string) => string,
): string {
  const event = t(`event_${eventType}`);
  if (!gender) return event;
  return `${t(gender === 'MALE' ? 'men' : 'women')} ${event.toLowerCase()}`;
}

export const EVENT_TYPES: EventType[] = [
  'SINGLES',
  'DOUBLES',
  'MIXED_DOUBLES',
  'TEAM',
];
