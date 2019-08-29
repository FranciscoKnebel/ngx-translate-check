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

export { inputFilesMap, translationsMap, mapAddString };