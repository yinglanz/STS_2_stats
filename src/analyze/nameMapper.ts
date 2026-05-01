/**
 * Convert STS2 identifier strings to friendly display names
 * Examples: CARD.BIG_BANG → "Big Bang", CHARACTER.DEFECT → "Defect"
 */

/**
 * Convert snake_case to Title Case
 * e.g., "BIG_BANG" → "Big Bang"
 */
function snakeCaseToTitleCase(text: string): string {
  return text
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Convert card ID to friendly name
 * CARD.BIG_BANG → "Big Bang"
 * CARD.STRIKE_DEFECT → "Strike (Defect)"
 */
export function getCardName(cardId: string): string {
  if (!cardId || cardId === "NONE" || cardId === "NONE.NONE") return "Unknown";

  const base = cardId.replace("CARD.", "");

  // Handle character-specific cards (e.g., STRIKE_DEFECT)
  const characterSuffixes = [
    "_DEFECT",
    "_IRONCLAD",
    "_SILENT",
    "_WATCHER",
    "_NECROBINDER",
    "_REGENT",
  ];

  for (const suffix of characterSuffixes) {
    if (base.endsWith(suffix)) {
      const name = snakeCaseToTitleCase(base.replace(suffix, ""));
      const charName = suffix.replace("_", "").toLowerCase();
      const charDisplayName = getCharacterName(`CHARACTER.${charName.toUpperCase()}`);
      return `${name} (${charDisplayName})`;
    }
  }

  return snakeCaseToTitleCase(base);
}

/**
 * Convert character ID to friendly name
 * CHARACTER.DEFECT → "Defect"
 */
export function getCharacterName(characterId: string): string {
  if (!characterId || characterId === "NONE") return "Unknown";

  const base = characterId.replace("CHARACTER.", "");
  return snakeCaseToTitleCase(base);
}

/**
 * Convert relic ID to friendly name
 * RELIC.STARTER_DECK → "Starter Deck"
 */
export function getRelicName(relicId: string): string {
  if (!relicId || relicId === "NONE" || relicId === "NONE.NONE") return "Unknown";

  // Handle RELIC. prefix or standalone
  const base = relicId.replace("RELIC.", "").replace(/^RELIC_/, "");

  return snakeCaseToTitleCase(base);
}

/**
 * Convert encounter ID to friendly name
 * ENCOUNTER.LAGAVULIN_MATRIARCH_BOSS → "Lagavulin Matriarch (Boss)"
 */
export function getEncounterName(encounterId: string): string {
  if (!encounterId || encounterId === "NONE" || encounterId === "NONE.NONE")
    return "Unknown";

  const base = encounterId.replace("ENCOUNTER.", "");

  // Extract type (BOSS, ELITE, WEAK, NORMAL) and remove from name
  let type = "";
  let cleanName = base;

  if (base.endsWith("_BOSS")) {
    type = "Boss";
    cleanName = base.replace(/_BOSS$/, "");
  } else if (base.endsWith("_ELITE")) {
    type = "Elite";
    cleanName = base.replace(/_ELITE$/, "");
  } else if (base.endsWith("_WEAK")) {
    type = "Weak";
    cleanName = base.replace(/_WEAK$/, "");
  } else if (base.endsWith("_NORMAL")) {
    type = "Monster";
    cleanName = base.replace(/_NORMAL$/, "");
  }

  const friendlyName = snakeCaseToTitleCase(cleanName);

  return type ? `${friendlyName} (${type})` : friendlyName;
}

/**
 * Get encounter type from ID
 */
export function getEncounterType(
  encounterId: string
): "boss" | "elite" | "monster" {
  if (encounterId.endsWith("_BOSS")) return "boss";
  if (encounterId.endsWith("_ELITE")) return "elite";
  return "monster";
}

/**
 * Convert potion ID to friendly name
 * POTION.STRENGTH_POTION → "Strength Potion"
 */
export function getPotionName(potionId: string): string {
  if (!potionId || potionId === "NONE") return "Unknown";

  const base = potionId.replace("POTION.", "");
  return snakeCaseToTitleCase(base);
}

/**
 * Convert event ID to friendly name
 * EVENT.NEOW → "Neow"
 */
export function getEventName(eventId: string): string {
  if (!eventId || eventId === "NONE") return "Unknown";

  const base = eventId.replace("EVENT.", "");
  return snakeCaseToTitleCase(base);
}

/**
 * Generic identifier to friendly name (tries to auto-detect type)
 */
export function getFriendlyName(id: string): string {
  if (!id || id === "NONE" || id === "NONE.NONE") return "Unknown";

  if (id.startsWith("CARD.")) return getCardName(id);
  if (id.startsWith("CHARACTER.")) return getCharacterName(id);
  if (id.startsWith("RELIC.") || id.startsWith("RELIC_")) return getRelicName(id);
  if (id.startsWith("ENCOUNTER.")) return getEncounterName(id);
  if (id.startsWith("POTION.")) return getPotionName(id);
  if (id.startsWith("EVENT.")) return getEventName(id);

  // Fallback: assume snake_case
  return snakeCaseToTitleCase(id);
}

/**
 * Batch convert array of IDs to friendly names
 */
export function getFriendlyNames(ids: string[]): string[] {
  return ids.map(getFriendlyName);
}

/**
 * Create a mapping of ID → friendly name for bulk conversions
 */
export function createNameMapping(ids: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  for (const id of ids) {
    mapping[id] = getFriendlyName(id);
  }
  return mapping;
}
