const inputFilesMap = new Map();
const translationsMap = new Map();

function mapAddString(map, str) {
  const found = map.get(str);

  if (found) {
    map.set(str, found+1);
  } else {
    map.set(str, 1);
  }
}

function mapAddTranslationString(map, language, str) {
  let foundLanguageMap = map.get(language);

  if (!foundLanguageMap) {
    map.set(language, new Map());

    foundLanguageMap = map.get(language);
  }

  mapAddString(foundLanguageMap, str);
}

export { inputFilesMap, translationsMap, mapAddString, mapAddTranslationString };