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

function mapToObj(strMap) {
  let obj = {};
  for (let [k, v] of strMap) {
    obj[k] = v;
  }
  return obj;
}

function translationMapToObj(map) {
  let obj = {};
  for (let [k, innerMap] of map) {
    obj[k] = mapToObj(innerMap);
  }
  return obj;
}

function mapToJson(map) {
  return JSON.stringify(mapToObj(map));
}

export { inputFilesMap, translationsMap, mapAddString, mapAddTranslationString, mapToJson, mapToObj, translationMapToObj };

