import { IPoint } from './Interactive';

export const INTERACTIVE_CLASS = 'interactive';
export const GROUP_CLASS = 'focus-group';
export const MOUSE = 'mouse';
export const TOUCH = 'touch';
export const DWELL = 'dwell';
export const KEYBOARD = 'keyboard';

export interface IRect
{
    x: number;
    y: number;
    width: number;
    height: number;
}

export function arePointsDifferent(a: IPoint, b: IPoint): boolean
{
    return a.x != b.x || a.y != b.y;
}

export function areRectsDifferent(a: IRect, b: IRect): boolean
{
    return a.x != b.x || a.y != b.y || a.width != b.width || a.height != b.height;
}

export function copyRectTo(from: IRect, to: IRect): void
{
    to.x = from.x;
    to.y = from.y;
    to.width = from.width;
    to.height = from.height;
}