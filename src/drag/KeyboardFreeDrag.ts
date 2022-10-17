import { DisposableGroup, math, Event, globalTimer } from '@fablevision/utils';
import { Interactive, IPoint } from '../Interactive';
import { Keyboard, KeyConfig } from '../Keyboard';
import { DragBounds, DragBoundsValidator, DragTarget, IDragController } from './interfaces';

export interface KeyboardFreeDragOpts<T extends DragTarget>
{
    target: T;
    interactive: Interactive;
    bounds?: DragBounds|DragBoundsValidator<T>;
    /** If arrow keys should be used for key controls. Defaults to true */
    arrows?: boolean;
    /** If number pad arrow keys should be used for key controls. Defaults to true */
    numArrows?: boolean;
    /** If WASD keys should be used for key controls. Defaults to true */
    wasd?: boolean;
    /**
     * If hitting ESC should end the drag. Activating the interactive item will always end it.
     * Defaults to true
     */
    escCancels?: boolean;
    /** If drag should be ended if focus leaves the target. Defaults to false */
    cancelOnFocusLoss?: boolean;
    /**
     * Orthoganal Movement speed while 'dragging'.
     * This will be units/second unless moveTickTime is provided (and > 0), in which case it will be units/tick.
     */
    moveSpeed: number;
    /**
     * An interval of seconds, greater than 0, upon which to move the dragged item.
     */
    moveTickTime?: number;
}

/**
 * Manages a keyboard drag, using arrow keys (or equivalent) to freely move the target, optionally
 * clamping to bounds. This requires use of the globalTimer Timer object in order to function.
 */
export class KeyboardFreeDrag<T extends DragTarget> implements IDragController<T>
{
    public target: T;
    private interactive: Interactive;
    private bounds: DragBounds | DragBoundsValidator<T> | null;
    public dragStarted: Event<T>;
    public dragComplete: Event<T>;
    private cleanup: DisposableGroup;
    private keyboardContext: DisposableGroup|null;
    private keyConfigs: KeyConfig[];
    private upHeld: boolean;
    private downHeld: boolean;
    private leftHeld: boolean;
    private rightHeld: boolean;
    private timer: number;
    private moveSpeed: number;
    private moveTick: number;

    constructor(opts: KeyboardFreeDragOpts<T>)
    {
        this.target = opts.target;
        this.interactive = opts.interactive;
        this.bounds = opts.bounds || null;
        this.keyboardContext = null;
        this.upHeld = this.downHeld = this.leftHeld = this.rightHeld = false;
        this.timer = 0;
        this.moveSpeed = opts.moveSpeed;
        this.moveTick = (opts.moveTickTime != undefined && opts.moveTickTime > 0) ? opts.moveTickTime : 0;

        this.keyConfigs = [
            // left
            {
                keys: [],
                down: () => this.leftHeld = true,
                up: () => this.leftHeld = false,
            },
            // right
            {
                keys: [],
                down: () => this.rightHeld = true,
                up: () => this.rightHeld = false,
            },
            // up
            {
                keys: [],
                down: () => this.upHeld = true,
                up: () => this.upHeld = false,
            },
            // down
            {
                keys: [],
                down: () => this.downHeld = true,
                up: () => this.downHeld = false,
            },
        ];
        const keyboard = Keyboard.instance;
        // add the configured keys
        if (opts.arrows !== false)
        {
            (this.keyConfigs[0].keys as string[]).push(keyboard.LEFT);
            (this.keyConfigs[1].keys as string[]).push(keyboard.RIGHT);
            (this.keyConfigs[2].keys as string[]).push(keyboard.UP);
            (this.keyConfigs[3].keys as string[]).push(keyboard.DOWN);
        }
        if (opts.numArrows !== false)
        {
            (this.keyConfigs[0].keys as string[]).push('num4');
            (this.keyConfigs[1].keys as string[]).push('num6');
            (this.keyConfigs[2].keys as string[]).push('num8');
            (this.keyConfigs[3].keys as string[]).push('num2');
        }
        if (opts.wasd !== false)
        {
            (this.keyConfigs[0].keys as string[]).push('a');
            (this.keyConfigs[1].keys as string[]).push('d');
            (this.keyConfigs[2].keys as string[]).push('w');
            (this.keyConfigs[3].keys as string[]).push('s');
        }
        if (opts.escCancels !== false)
        {
            this.keyConfigs.push({
                keys: keyboard.ESC,
                up: () => this.stopDrag(),
            });
        }

        this.dragStarted = new Event();
        this.dragComplete = new Event();

        this.cleanup = new DisposableGroup(
            this.interactive.onActivate.add(this.onActivate.bind(this)),
            this.dragStarted,
            this.dragComplete,
        );
        if (opts.cancelOnFocusLoss)
        {
            this.cleanup.add(this.interactive.onBlur.add(this.onFocusLost.bind(this)));
        }
    }

    private onActivate(pointerPos: IPoint|null)
    {
        // only activate when *not* clicked/tapped
        if (pointerPos) return;
        // if dragging, stop drag
        if (this.keyboardContext)
        {
            this.stopDrag();
        }
        // start drag
        else
        {
            this.startDrag();
        }
    }

    private onFocusLost(): void
    {
        if (this.keyboardContext)
        {
            this.stopDrag();
        }
    }

    private startDrag(): void
    {
        this.keyboardContext = Keyboard.instance.addQuickContext(...this.keyConfigs);
        this.timer = 0;
        this.dragStarted.emit(this.target);
        // to our drag cleanup, add the update listener for automatic removal
        this.keyboardContext.add(globalTimer.add(this.update.bind(this)));
    }

    private stopDrag(emit = true): void
    {
        if (this.keyboardContext)
        {
            this.keyboardContext.dispose();
            this.keyboardContext = null;
        }
        if (emit)
        {
            this.dragComplete.emit(this.target);
        }
    }

    public cancel(): void
    {
        this.stopDrag(false);
    }

    private update = (deltaSec: number): void =>
    {
        // if not dragging, just silently bail
        if (!this.keyboardContext) return;

        let movement = this.moveSpeed;
        if (this.moveTick)
        {
            this.timer -= deltaSec;
            if (this.timer <= 0)
            {
                this.timer += this.moveTick;
            }
            else
            {
                // don't move if we aren't ready for another tick
                return;
            }
        }
        else
        {
            movement *= deltaSec;
        }
        let moveX = 0;
        let moveY = 0;
        if (this.leftHeld)
        {
            moveX -= movement;
        }
        if (this.rightHeld)
        {
            moveX += movement;
        }
        if (this.upHeld)
        {
            moveY -= movement;
        }
        if (this.downHeld)
        {
            moveY += movement;
        }
        let targX = this.target.x + moveX;
        let targY = this.target.y + moveY;
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
        // if auto-updating position doesn't pan out, needs a manual update here
        // this.interactive.updatePosition();
    }

    public dispose(): void
    {
        this.cleanup.dispose();
        this.keyboardContext?.dispose();
    }
}