import { commandGroupOf } from '../../util/commands';
import custom from './custom';
import target from './target';
import update from './update';

export default commandGroupOf('attack', [custom, target, update])
