import { IDisposable, Event, DoubleEvent } from '@fablevision/utils';
import { ComplexFocusContext } from './complex';
import type { InteractionManager, InteractiveList } from './InteractionManager';
import { GROUP_CLASS, IRect, KEYBOARD, MOUSE, TOUCH } from './internal';

const SUPPORTS_POINTERS = !!window.PointerEvent;
const SUPPORTS_TOUCH = !!window.TouchEvent && 'ontouchstart' in window;

const EVENTS = {
    down: 'mousedown',
    up: 'mouseup',
    move: 'mousemove',
    over: 'mouseover',
    out: 'mouseout',
    cancel: '',
};
if (SUPPORTS_POINTERS)
{
    EVENTS.down = 'pointerdown';
    EVENTS.up = 'pointerup';
    EVENTS.move = 'pointermove';
    EVENTS.over = 'pointerover';
    EVENTS.out = 'pointerout';
    EVENTS.cancel = 'pointercancel';
}
else if (SUPPORTS_TOUCH)
{
    EVENTS.down = 'touchdown';
    EVENTS.up = 'touchup';
    EVENTS.move = 'touchmove';
    EVENTS.cancel = 'touchcancel';
    // leave over/out alone, because I'm not sure how head tracking might work on mobile and we generally don't want to
    // focus on things when dragging fingers around - it's odd behavior
    // EVENTS.over = 'touchover';
    // EVENTS.out = 'touchout';
}

export enum DragStrategy
{
    /** No dragging */
    None = 0,
    /** Drag with mouse/touch, no clicking */
    DragOnly,
    /** Drag with mouse/touch, clicking starts a drag to be stopped with another click. */
    DragWithStickyClick,
    /** Drag with mouse/touch, but clicking/tapping activates the element instead */
    DragOrClick,
    /** Drag with mouse/touch, but clicking/tapping starts a "sticky" drag, where another click/tap ends the drag. */
    DragWithStickyClickTap
}

export enum KeyboardActivateStrategy
{
    /** Keyboard keys activate the item on release */
    Normal,
    /** Keyboard keys trigger down/up events on the item */
    Hold,
}

export enum DragType {
    /** No active drag. */
    None = 0,
    /** A drag with a held mouse button or finger touching the screen. */
    Held,
    /** A mouse driven drag that will release upon the next click (anywhere). */
    StickyClick,
    /** A touch driven drag that will release upon the next tap (anywhere). */
    StickyTap,
    /** A keyboard driven drag (non-default, implemenation specific, see the 'drag' namespace). */
    Keyboard,
}

export interface InteractiveOpts
{
    alwaysDwell?: boolean;
    childContext?: InteractiveList|ComplexFocusContext;
    cursor?: string;
    role?: string;
    label?: string;
    css?: Partial<CSSStyleDeclaration>;
    draggable?: boolean|DragStrategy;
    minDragDist?: number;
    pointerOnly?: boolean;
    keyboardOnly?: boolean;
    keyControl?: KeyboardActivateStrategy;
}

export interface IPoint
{
    x: number;
    y: number;
}

/**
 * Because we are relying on browser focus events, using a flag that we then consume is the easiest way to
 * determine if the focus event happened from a mouseover.
 */
let NEXT_FOCUS_SOURCE: typeof TOUCH | typeof MOUSE | typeof KEYBOARD = KEYBOARD;
let NEXT_BLUR_SOURCE: typeof TOUCH | typeof MOUSE | typeof KEYBOARD = KEYBOARD;

/**
 * Touch end events apply focus to elements after the event is handled, and that messes with our focus listeners.
 * Instead, this flag lets us ignore focus events immediately after a touch end.
 */
let IGNORE_NEXT_FOCUS = false;
function clearIgnoreFocus()
{
    IGNORE_NEXT_FOCUS = false;
}

class StickyDragIdChecker
{
    private used: Set<number> = new Set();
    private idsForRemoval: number[] = [];
    private timeout: number = 0;

    public claimId(id: number)
    {
        this.used.add(id);
    }

    public freeId(id: number)
    {
        // delete ids later, to avoid any possibility of a click being handled by the claimant, the id freed, and then
        // the sticky dragged item getting told about the pointer up
        this.idsForRemoval.push(id);
        if (!this.timeout)
        {
            this.timeout = setTimeout(this.deleteIdsLater, 0);
        }
    }

    private deleteIdsLater = () =>
    {
        for (let i = 0; i < this.idsForRemoval.length; ++i)
        {
            this.used.delete(this.idsForRemoval[i]);
        }
        this.idsForRemoval.length = 0;
        this.timeout = 0;
    }

    public isIdFree(id: number)
    {
        return !this.used.has(id);
    }
}
/**
 * Singleton object to track pointer id usage between items so that a sticky drag can't end by tapping on another
 * interactive item.
 */
const idTracker = new StickyDragIdChecker();

/**
 * Rectangle for handing out in 'bounds' when not overridden.
 */
const EMPTY_RECT = {x:0, y:0, width:0, height:0};

export class Interactive implements IDisposable
{
    public manager: InteractionManager | null = null;
    /**
     * Source of current focus. Should be treated as read-only, and primarily for InteractionManager's use.
     */
    public focusSource: typeof TOUCH | typeof MOUSE | typeof KEYBOARD = KEYBOARD;
    /** Event when the item becomes focused. Event data is `true` if done via (real) mouse/touch, false otherwise. */
    public onFocus: Event<boolean>;
    /** Event when the item loses focus. Event data is `true` if done via (real) mouse/touch, false otherwise. */
    public onBlur: Event<boolean>;
    /** Event when activated (clicked, hit enter, dwell trigger). Event data is global position (game space) if done via (real) mouse/touch, null otherwise. */
    public onActivate: Event<IPoint | null>;
    public dragStart: DoubleEvent<IPoint, DragType>;
    public dragMove: DoubleEvent<IPoint, DragType>;
    public dragStop: DoubleEvent<IPoint, DragType>;
    public keyStart: Event<void>;
    public keyStop: Event<void>;
    /** Always enable dwell activation on this item. */
    public alwaysDwell: boolean;
    /** Should not be accessible via keyboard ever. */
    public pointerOnly: boolean;
    /** Should not be accessible via mouse/touch ever. */
    public keyboardOnly: boolean;
    /** The invisible HTML element for this item to handle all clicks & highlighting */
    public htmlElement: HTMLElement;
    /** If this focus item is a group (and should use a different focus UI as a signifier), the child context to be used upon activation */
    public childContext: InteractiveList | ComplexFocusContext | null;
    protected _visible: boolean = true;
    protected _enabled: boolean = true;
    /** ID of pointer that is currently down on the item */
    protected activePointerId: number = -1;
    /** If the active (held) pointer is in the element */
    protected pointerIn: boolean = false;
    /** Is draggable (don't emit activate on clicks) */
    protected draggable: DragStrategy;
    /** Minimum distance mouse must move to not be considered a click */
    protected minDragDistSq: number;
    /** Position for tracking distance */
    protected dragStartPoint: IPoint;
    /** If we are currently being dragged (if not, we are calculating a drag start) */
    protected currentDragType: DragType;
    protected keyStrat: KeyboardActivateStrategy;

    constructor(opts: InteractiveOpts)
    {
        this.onFocus = new Event();
        this.onBlur = new Event();
        this.onActivate = new Event();
        this.dragStart = new DoubleEvent();
        this.dragMove = new DoubleEvent();
        this.dragStop = new DoubleEvent();
        this.keyStart = new Event();
        this.keyStop = new Event();
        this.alwaysDwell = !!opts.alwaysDwell;
        if (!opts.draggable || typeof opts.draggable == 'boolean')
        {
            this.draggable = opts.draggable ? DragStrategy.DragOnly : DragStrategy.None;
        }
        else
        {
            this.draggable = opts.draggable;
        }
        this.minDragDistSq = Math.pow(opts.minDragDist || 20, 2);
        this.dragStartPoint = {x: 0, y: 0};
        this.currentDragType = DragType.None;
        this.pointerOnly = !!opts.pointerOnly;
        this.keyboardOnly = !!opts.keyboardOnly;
        this.keyStrat = opts.keyControl || KeyboardActivateStrategy.Normal;
        if (this.keyStrat == KeyboardActivateStrategy.Normal)
        {
            this.keyStop.on(() => {
                if (this.manager!.enabled)
                {
                    this.onActivate.emit(null);
                }
            });
        }
        this.htmlElement = document.createElement('div');
        this.htmlElement.classList.add('interactive');
        this.childContext = opts.childContext ? opts.childContext : null;
        if (opts.role)
        {
            this.htmlElement.ariaRoleDescription = opts.role;
        }
        if (opts.label)
        {
            this.htmlElement.ariaLabel = opts.label;
        }
        this.htmlElement.style.cursor = opts.cursor || 'pointer';
        if (this.childContext || this.keyboardOnly)
        {
            this.htmlElement.style.pointerEvents = 'none';
            if (this.childContext)
            {
                this.htmlElement.classList.add(GROUP_CLASS);
            }
        }
        else
        {
            this.onPointerCancel = this.onPointerCancel.bind(this);
            this.onPointerDown = this.onPointerDown.bind(this);
            this.onPointerMove = this.onPointerMove.bind(this);
            this.onPointerUp = this.onPointerUp.bind(this);
            this.onPointerOver = this.onPointerOver.bind(this);
            this.onPointerOut = this.onPointerOut.bind(this);
            // TODO: could probably be improved here
            this.htmlElement.addEventListener(EVENTS.down as any, this.onPointerDown);
            this.htmlElement.addEventListener(EVENTS.over as any, this.onPointerOver);
            this.htmlElement.addEventListener(EVENTS.out as any, this.onPointerOut);
            this.htmlElement.addEventListener('pointercancel', () => this.blur());
            // this.htmlElement.addEventListener('click', (ev) => console.log('Caught mystery click', ev));
        }
        this.htmlElement.addEventListener('focus', () => {
            if (IGNORE_NEXT_FOCUS)
            {
                IGNORE_NEXT_FOCUS = false;
                // clear browser focus? this could be removed without breaking anything
                this.blur();
                // absolutely do not emit the focus event
                return;
            }
            this.focusSource = NEXT_FOCUS_SOURCE;
            const fromMouse = NEXT_FOCUS_SOURCE != KEYBOARD;
            NEXT_FOCUS_SOURCE = KEYBOARD;
            this.onFocus.emit(fromMouse);
        });
        this.htmlElement.addEventListener('blur', () => {
            // in the off chance that we have a focus() caused by a mouseover before a mouseout is handled,
            // check for both blur and focus flags
            const fromMouse = NEXT_BLUR_SOURCE != KEYBOARD || NEXT_FOCUS_SOURCE != KEYBOARD;
            NEXT_BLUR_SOURCE = KEYBOARD;
            this.onBlur.emit(fromMouse);
        });
        this.htmlElement.style.position = 'absolute';
        if (opts.css)
        {
            Object.assign(this.htmlElement.style, opts.css);
        }
    }

    public get isGroup(): boolean
    {
        return !!this.childContext;
    }

    public get visible(): boolean { return this._visible; }
    public set visible(visible: boolean)
    {
        this._visible = visible;
        this.updateHTMLEnabled();
    }

    public get enabled(): boolean { return this._enabled; }
    public set enabled(enabled: boolean)
    {
        this._enabled = enabled;
        this.updateHTMLEnabled();
    }

    public get focusable(): boolean { return this._visible && this._enabled; }

    public get isBeingHeld() : boolean { return this.activePointerId >= 0; }

    private updateHTMLEnabled()
    {
        this.htmlElement.style.display = (this._visible && this._enabled) ? 'block' : 'none';
        if (!(this._visible && this._enabled) && this.activePointerId > -1)
        {
            idTracker.freeId(this.activePointerId);
        }
    }

    /**
     * Implementation specific updating of HTML element positioning. Must be overridden.
     */
    public updatePosition(): void
    {
        // To be overridden by specific implementations
        this.htmlElement.style.width = '10px';
        this.htmlElement.style.height = '10px';
    }

    /**
     * Implementation specific hit testing against item. Must be overridden.
     */
    public hitTest(globalX: number, globalY: number): boolean
    {
        return false;
    }

    /**
     * Global boundaries of the object. Must be overridden.
     */
    public get bounds(): IRect
    {
        return EMPTY_RECT;
    }

    public dispose(): void
    {
        if (this.activePointerId > -1)
        {
            idTracker.freeId(this.activePointerId);
        }
        this.onFocus.dispose();
        this.onBlur.dispose();
        this.onActivate.dispose();
        this.dragStart.dispose();
        this.dragMove.dispose();
        this.dragStop.dispose();
        this.keyStart.dispose();
        this.keyStop.dispose();
        this.removeWindowListeners();
        // ensure that the div doesn't stick around
        this.htmlElement.remove();
    }

    public focus(): void
    {
        this.htmlElement.focus();
    }

    public blur(): void
    {
        this.htmlElement.blur();
    }

    public cancelDrag(keepIdClaimed = false): void
    {
        if (!keepIdClaimed && this.activePointerId > -1)
        {
            idTracker.freeId(this.activePointerId);
        }
        this.activePointerId = -1;
        this.currentDragType = DragType.None;
        this.removeWindowListeners();
    }

    public transferDrag(recipient: Interactive): void
    {
        recipient.activePointerId = this.activePointerId;
        recipient.pointerIn = true;
        recipient.currentDragType = this.currentDragType;
        recipient.addWindowEvents();

        this.cancelDrag(true);
    }

    private onPointerOver(ev: PointerEvent|TouchEvent|MouseEvent)
    {
        if (!this.manager!.focusEnabled) return;

        if (isTouch(ev))
            NEXT_FOCUS_SOURCE = TOUCH;
        else
            NEXT_FOCUS_SOURCE = MOUSE;
        this.focus();
        if (this.getId(ev) == this.activePointerId)
        {
            this.pointerIn = true;
        }
    }

    private onPointerOut(ev: PointerEvent|TouchEvent|MouseEvent)
    {
        if (!this.manager!.focusEnabled) return;

        if (isTouch(ev))
            NEXT_BLUR_SOURCE = TOUCH;
        else
            NEXT_BLUR_SOURCE = MOUSE;
        this.blur();
        if (this.getId(ev) == this.activePointerId)
        {
            this.pointerIn = false;
        }
    }

    private onPointerDown(ev: PointerEvent|TouchEvent|MouseEvent)
    {
        if (!this.manager!.enabled) return;
        // console.log('pointer down', ev);
        if (this.activePointerId >= 0) return;

        if (isTouch(ev))
            NEXT_FOCUS_SOURCE = TOUCH;
        else
            NEXT_FOCUS_SOURCE = MOUSE;
        this.activePointerId = this.getId(ev);
        this.pointerIn = true;
        idTracker.claimId(this.activePointerId);

        this.addWindowEvents();

        if (this.draggable)
        {
            ev.preventDefault();
            // if we are already dragging due to sticky click, we don't need to emit anything else
            if (this.currentDragType) return;

            const point = this.mapEvToPoint(ev);

            if (this.draggable == DragStrategy.DragOnly)
            {
                this.currentDragType = DragType.Held;
                this.dragStart.emit(point, this.currentDragType);
            }
            else
            {
                this.dragStartPoint.x = point.x;
                this.dragStartPoint.y = point.y;
            }
        }
    }

    private addWindowEvents()
    {
        window.addEventListener(EVENTS.move as any, this.onPointerMove);
        window.addEventListener(EVENTS.up as any, this.onPointerUp);
        if (EVENTS.cancel)
        {
            window.addEventListener(EVENTS.cancel as any, this.onPointerCancel);
        }
    }

    private onPointerMove(ev: PointerEvent|TouchEvent|MouseEvent)
    {
        if (!this.manager!.enabled) return;
        const id = this.getId(ev);
        // Bail if the id is not our id, and the following condition is not met:
        // * we are performing a sticky tap (we'd get a new touch id for the 2nd tap)
        // * _and_ the pointer id has not been claimed by another item during its pointer down
        if ((this.activePointerId != id) &&
            (this.currentDragType != DragType.StickyTap || !idTracker.isIdFree(id)))
        {
            return;
        }

        if (this.draggable)
        {
            ev.preventDefault();

            const point = this.mapEvToPoint(ev);
            if (this.currentDragType == DragType.None &&
                (this.draggable == DragStrategy.DragOrClick || this.draggable == DragStrategy.DragWithStickyClick || this.draggable == DragStrategy.DragWithStickyClickTap))
            {
                if (distSq(point, this.dragStartPoint) >= this.minDragDistSq)
                {
                    this.currentDragType = DragType.Held;
                    this.dragStart.emit(this.dragStartPoint, this.currentDragType);
                }
            }
            if (this.currentDragType)
            {
                this.dragMove.emit(point, this.currentDragType);
            }
        }
    }

    private onPointerUp(ev: PointerEvent|TouchEvent|MouseEvent)
    {
        // console.log('pointer up', ev);
        const id = this.getId(ev);
        // Bail if the id is not our id, and the following condition is not met:
        // * we are performing a sticky tap (we'd get a new touch id for the 2nd tap)
        // * _and_ the pointer id has not been claimed by another item during its pointer down
        if ((this.activePointerId != id) &&
            (this.currentDragType != DragType.StickyTap || !idTracker.isIdFree(id)))
        {
            return;
        }

        ev.preventDefault();

        const touch = isTouch(ev);
        const point = this.mapEvToPoint(ev);
        let shouldCleanUp = true;
        if (this.currentDragType)
        {
            this.currentDragType = DragType.None;
            if (this.manager!.enabled)
            {
                this.dragStop.emit(point, this.currentDragType);
            }
        }
        else if (this.pointerIn || touch)
        {
            if (this.manager!.enabled)
            {
                if (!touch && (this.draggable == DragStrategy.DragWithStickyClick || this.draggable == DragStrategy.DragWithStickyClickTap))
                {
                    this.currentDragType = DragType.StickyClick;
                    this.dragStart.emit(point, this.currentDragType);
                    shouldCleanUp = false;
                }
                else if (touch && this.draggable == DragStrategy.DragWithStickyClickTap)
                {
                    this.currentDragType = DragType.StickyTap;
                    this.dragStart.emit(point, this.currentDragType);
                    shouldCleanUp = false;
                    // still free the pointer id
                    idTracker.freeId(this.activePointerId);
                }
                else if (this.draggable != DragStrategy.DragOnly)
                {
                    this.onActivate.emit(this.mapEvToPoint(ev));
                }
            }
        }

        if (shouldCleanUp)
        {
            if (touch)
            {
                // ignore the focus that triggers from the pointer up event
                IGNORE_NEXT_FOCUS = true;
                // in case the browser wasn't going to apply focus, clear the flag right after
                setTimeout(clearIgnoreFocus, 500);
            }
            idTracker.freeId(this.activePointerId);
            this.activePointerId = -1;
            this.removeWindowListeners();
        }
    }

    private onPointerCancel(ev: PointerEvent|TouchEvent|MouseEvent)
    {
        if (this.activePointerId != this.getId(ev)) return;

        if (this.currentDragType)
        {
            this.currentDragType = DragType.None;
            if (this.manager!.enabled)
            {
                this.dragStop.emit(this.mapEvToPoint(ev), this.currentDragType);
            }
        }

        idTracker.freeId(this.activePointerId);
        this.activePointerId = -1;
        this.removeWindowListeners();
    }

    private getId(ev: PointerEvent|TouchEvent|MouseEvent): number
    {
        if (SUPPORTS_POINTERS && ev instanceof PointerEvent)
        {
            return ev.pointerId;
        }
        else if (SUPPORTS_TOUCH && ev instanceof TouchEvent)
        {
            // if we have an active pointer id that matches one of the changed touches,
            // use that one (because it is relevant to us)
            for (const touch of ev.changedTouches)
            {
                if (touch.identifier == this.activePointerId)
                {
                    return this.activePointerId;
                }
            }
            // otherwise use the first changed touch
            return ev.changedTouches[0].identifier;
        }
        else
        {
            // otherwise just use 1 as the mouse pointer ID
            return 1;
        }
    }

    private removeWindowListeners()
    {
        window.removeEventListener(EVENTS.move as any, this.onPointerMove);
        window.removeEventListener(EVENTS.up as any, this.onPointerUp);
        window.removeEventListener(EVENTS.cancel as any, this.onPointerCancel);
    }

    private mapEvToPoint(ev: PointerEvent|TouchEvent|MouseEvent)
    {
        let x!: number;
        let y!: number;

        if (SUPPORTS_TOUCH && ev instanceof TouchEvent)
        {
            for (const touch of ev.changedTouches)
            {
                if (touch.identifier == this.activePointerId)
                {
                    x = touch.clientX;
                    y = touch.clientY;
                    break;
                }
            }
        }
        else
        {
            x = (ev as MouseEvent).clientX;
            y = (ev as MouseEvent).clientY;
        }

        return this.manager!.renderer.mapClientPosToPoint(x, y);
    }
}

function distSq(p1: IPoint, p2: IPoint)
{
    return (p1.x - p2.x) * (p1.x - p2.x) + (p1.y - p2.y) * (p1.y - p2.y)
}

function isTouch(ev: PointerEvent|TouchEvent|MouseEvent)
{
    return (SUPPORTS_TOUCH && ev instanceof TouchEvent) ||
        (SUPPORTS_POINTERS && (ev as PointerEvent).pointerType == 'touch');
}