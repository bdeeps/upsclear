// UPSClear's chapters, in reading order.
import anatomy from './anatomy.js';
import acdc from './ac-dc.js';
import inverter from './inverter.js';
import switchover from './switchover.js';
import runtime from './runtime.js';
import battery from './battery.js';

export const BOX = { slug: 'upsclear', title: 'UPSClear' };
export const CHAPTERS = [anatomy, acdc, inverter, switchover, runtime, battery];
