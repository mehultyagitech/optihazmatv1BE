import prisma from '../database/Prisma';

/**
 * An inventory point's number carries the prefix of the location category its
 * diagram was cropped under, so a Main Deck point reads MD-001 and an Engine
 * Room point ER-001.
 */
const CATEGORY_PREFIX: Record<string, string> = {
  'cargo spaces': 'CS',
  'engine room': 'ER',
  hull: 'HU',
  'main deck': 'MD',
  superstructure: 'SS',
  others: 'OTH',
};

// A diagram cropped under some other category (only older ones can be) falls
// back to the initials of its name.
export function categoryPrefix(name?: string | null): string {
  const key = String(name ?? '')
    .trim()
    .toLowerCase();
  if (CATEGORY_PREFIX[key]) return CATEGORY_PREFIX[key];
  const initials = key
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map((word) => word[0])
    .join('')
    .toUpperCase();
  return initials.slice(0, 3) || 'IP';
}

/**
 * Numbers every inventory point of a vessel. The points of one location
 * category are numbered together, oldest first, so a vessel's Main Deck points
 * run MD-001, MD-002, ... across all of its Main Deck diagrams.
 */
export async function inventoryPointNumbers(vesselId: string): Promise<Map<string, string>> {
  const pins = await prisma.pins.findMany({
    where: { locationDiagram: { vesselId } },
    select: {
      id: true,
      locationDiagram: { select: { location: { select: { name: true } } } },
    },
    orderBy: { createdAt: 'asc' },
  });

  const used = new Map<string, number>();
  const numbers = new Map<string, string>();
  for (const pin of pins) {
    const prefix = categoryPrefix(pin.locationDiagram?.location?.name);
    const next = (used.get(prefix) ?? 0) + 1;
    used.set(prefix, next);
    numbers.set(pin.id, `${prefix}-${String(next).padStart(3, '0')}`);
  }
  return numbers;
}
