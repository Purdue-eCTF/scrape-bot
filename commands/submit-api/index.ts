import { commandGroupOf } from '../../util/commands';
import designDoc from './designDoc';
import photo from './photo';

export default commandGroupOf('submit-api', [photo, designDoc])
