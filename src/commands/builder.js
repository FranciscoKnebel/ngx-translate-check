import files from './files';
import diff from './diffLang';
import diffInput from './diffInputLang';

export function commandBuilder(program) {
  files(program);
  diff(program);
  diffInput(program);
}

export default commandBuilder;