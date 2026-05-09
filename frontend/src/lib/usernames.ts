export const PLACEHOLDER_USERNAMES = [
  "tylerprovider",
  "mscorsese",
  "baris_saydam",
  "semihmutsuz",
  "asliildir",
  "batuhanfurkan5",
];

export function pickRandomUsernames(count: number): string[] {
  return [...PLACEHOLDER_USERNAMES].sort(() => Math.random() - 0.5).slice(0, count);
}
