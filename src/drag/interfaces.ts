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