import { DisposableGroup, DoubleEvent, Event, math } from '@fablevision/utils';
import { DragType, Interactive, IPoint } from '../Interactive';
import { DragTarget, DragBounds, DragBoundsValidator, IDragController } from './interfaces';

export interface StandardDragOpts<T extends DragTarget>
{
    target: T;
    interactive: Interactive;
    bounds?: DragBounds|DragBoundsValidator<T>;
}

/**
 * Manages a standard pointer driven drag, maintaining movement and clamping to optional bounds.
 */
export class StandardDrag<T extends DragTarget> implements IDragController<T>
{
    public target: T;
    private interactive: Interactive;
    private bounds: DragBounds|DragBoundsValidator<T>|null;
    private dragOffset: IPoint;
    private currentDragType: DragType|null;
    private cleanup: DisposableGroup;
    public dragStarted: DoubleEvent<T, DragType>;
    public dragComplete: Event<T>;

    constructor(opts: StandardDragOpts<T>)
    {
        this.target = opts.target;
        this.interactive = opts.interactive;
        this.bounds = opts.bounds || null;
        this.dragOffset = {x: 0, y: 0};
        this.currentDragType = null;
        this.dragStarted = new DoubleEvent();
        this.dragComplete = new Event();

        this.cleanup = new DisposableGroup(
            this.interactive.dragStart.add(this.onDragStart.bind(this)),
            this.interactive.dragMove.add(this.onDragMove.bind(this)),
            this.interactive.dragStop.add(this.onDragEnd.bind(this)),
            this.dragStarted,
            this.dragComplete,
        );
    }

    private onDragStart(globalPos: IPoint, type: DragType)
    {
        this.currentDragType = type;
        this.dragOffset.x = this.target.x - globalPos.x;
        this.dragOffset.y = this.target.y - globalPos.y;

        this.dragStarted.emit(this.target, this.currentDragType);
    }

    private onDragMove(globalPos: IPoint)
    {
        this.moveTarget(globalPos);
    }

    private moveTarget(globalPos: IPoint)
    {
        let targX = globalPos.x + this.dragOffset.x;
        let targY = globalPos.y + this.dragOffset.y;
        if (this.bounds)
        {
            if (typeof this.bounds == 'function')
            {
                // if validation returns false, do not move target
                if (!this.bounds(this.target))
                {
                    targX = this.target.x;
                    targY = this.target.y;
                }
            }
            else
            {
                targX = math.clamp(targX, this.bounds.left, this.bounds.right);
                targY = math.clamp(targY, this.bounds.top, this.bounds.bottom);
            }
        }
        this.target.x = targX;
        this.target.y = targY;
    }

    private onDragEnd(globalPos: IPoint)
    {
        this.moveTarget(globalPos);
        this.currentDragType = null;
        // if auto-updating position doesn't pan out, needs a manual update here
        // this.interactive.updatePosition();

        this.dragComplete.emit(this.target);
    }

    public cancel(): void
    {
        this.interactive.cancelDrag();
    }

    public dispose(): void
    {
        this.cleanup?.dispose();
    }
}