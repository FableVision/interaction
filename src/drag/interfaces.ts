import { DoubleEvent, Event, IDisposable } from '@fablevision/utils';
import { DragType } from '../Interactive';

export interface DragTarget
{
    x: number;
    y: number;
}

export interface DragBounds
{
    top: number;
    left: number;
    bottom: number;
    right: number;
}

export type DragBoundsValidator<T extends DragTarget> = (target: T) => boolean;

export interface IDragController<T extends DragTarget, R = any> extends IDisposable
{
    dragStarted: Event<T>|DoubleEvent<T, DragType>;
    dragComplete: Event<T>|DoubleEvent<T, R>;
    cancel(): void;
}