export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Infers a single representative emoji from a trip/place name. Best-effort, never required. */
export function inferTripEmoji(name: string): string {
  const n = name.toLowerCase();
  const table: Array<[RegExp, string]> = [
    [/japan|tokyo|kyoto|osaka/, "🗼"],
    [/italy|rome|venice|milan|tuscany/, "🍝"],
    [/thailand|bangkok|phuket/, "🛕"],
    [/france|paris/, "🥐"],
    [/india|delhi|mumbai|goa|kerala|rajasthan/, "🕌"],
    [/greece|athens|santorini/, "🏛️"],
    [/spain|barcelona|madrid/, "💃"],
    [/iceland/, "🧊"],
    [/switzerland|alps/, "🏔️"],
    [/indonesia|bali/, "🌴"],
    [/nepal|himalay/, "⛰️"],
    [/uae|dubai/, "🏙️"],
    [/vietnam/, "🍜"],
    [/uk|london|england/, "🎡"],
    [/usa|new york|america/, "🗽"],
    [/beach|island|maldives/, "🏝️"],
  ];
  for (const [re, emoji] of table) {
    if (re.test(n)) return emoji;
  }
  return "✈️";
}
