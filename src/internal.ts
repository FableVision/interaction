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

/** Clips an item rect so it doesn't go outside the view rect. Returns true if it is still in bounds at all. */
export function clipRect(view: IRect, item: IRect): boolean
{
    if (item.y < view.y)
    {
        item.height += (item.y - view.y);
        item.y = view.y;
    }
    if (item.x < 0)
    {
        item.width += (item.x - view.x);
        item.x = view.x;
    }
    if (item.y + item.height > view.y + view.height)
    {
        item.height = view.height - item.y;
    }
    if (item.x + item.width > view.x + view.width)
    {
        item.width = view.width - item.x;
    }
    return item.width > 0 && item.height > 0;
}