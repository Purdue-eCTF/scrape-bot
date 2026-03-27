import { commandGroupOf } from '../../util/commands';
import target from './target';
import sus from './sus';

export default commandGroupOf('attack', [target, sus]);
