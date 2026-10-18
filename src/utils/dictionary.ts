export interface InputUsage {
  amount: number;
  files: string[];
}

export type TranslationUsageMap = Map<string, Map<string, number>>;

export function addInputString(
  map: Map<string, InputUsage>,
  translationKey: string,
  fileName: string,
): void {
  const existing = map.get(translationKey);

  if (existing) {
    existing.amount += 1;
    existing.files.push(fileName);
    return;
  }

  map.set(translationKey, { amount: 1, files: [fileName] });
}

export function addTranslationString(
  map: TranslationUsageMap,
  languageFile: string,
  translationKey: string,
): void {
  let languageMap = map.get(languageFile);

  if (!languageMap) {
    languageMap = new Map<string, number>();
    map.set(languageFile, languageMap);
  }

  languageMap.set(translationKey, (languageMap.get(translationKey) ?? 0) + 1);
}

export function mapToObj<T>(map: Map<string, T>): Record<string, T> {
  return Object.fromEntries(map.entries());
}

export function translationMapToObj(
  map: TranslationUsageMap,
): Record<string, Record<string, number>> {
  const result: Record<string, Record<string, number>> = Object.create(null) as Record<
    string,
    Record<string, number>
  >;

  for (const [languageFile, translations] of map.entries()) {
    result[languageFile] = mapToObj(translations);
  }

  return result;
}

export function diffKeys<T>(
  left: Record<string, T>,
  right: Record<string, T>,
): [Record<string, T>, Record<string, T>] {
  const leftOnly = Object.fromEntries(
    Object.entries(left).filter(([key]) => !Object.hasOwn(right, key)),
  );
  const rightOnly = Object.fromEntries(
    Object.entries(right).filter(([key]) => !Object.hasOwn(left, key)),
  );

  return [leftOnly, rightOnly];
}
