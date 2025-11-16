import type { Command, CommandGroup } from '../util/commands';

import challenges from './challenges';
import report from './report';
import scoreboard from './scoreboard';
import submit from './submit';
import attack from './attack';
import load from './load';

const commands: (Command | CommandGroup)[] = [challenges, report, scoreboard, submit, attack, load];
export default commands;
