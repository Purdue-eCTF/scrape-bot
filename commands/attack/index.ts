import { commandGroupOf } from '../../util/commands';
import custom from './custom';
import target from './target';

export default commandGroupOf('attack', [custom, target])
