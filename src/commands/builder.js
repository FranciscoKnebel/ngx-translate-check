import files from './files';
import diff from './diffLang';

export function commandBuilder(program) {
  files(program);
  diff(program);
}

export default commandBuilder;