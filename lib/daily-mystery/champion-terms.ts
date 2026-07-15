export function buildChampionProtectedTerms(name: string, aliases: string[] = []) {
  const terms = new Set<string>([name, ...aliases]);
  terms.add(`${name}'s`);
  terms.add(`the ${name}`);
  return [...terms];
}
