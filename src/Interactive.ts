import { IDisposable, Event } from '@fablevision/utils';
import type { InteractionManager, InteractiveList } from './InteractionManager';
import { GROUP_CLASS } from './internal';

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
    /** Drag with mouse/touch, clicking starts a drag to be stopped with another click. Not yet implemented */
    DragWithStickyClick,
    /** Drag with mouse/touch, but clicking activates the element instead */
    DragOrClick,
}

export enum KeyboardActivateStrategy
{
    /** Keyboard keys activate the item on release */
    Normal,
    /** Keyboard keys trigger down/up events on the item */
    Hold,
}

export interface InteractiveOpts
{
    alwaysDwell?: boolean;
    childContext?: InteractiveList;
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
let NEXT_FOCUS_FROM_MOUSE = false;

export class Interactive implements IDisposable
{
    public manager: InteractionManager | null = null;
    /** Event when the item becomes focused. Event data is `true` if done via (real) mouse/touch, false otherwise. */
    public onFocus: Event<boolean>;
    /** Event when the item loses focus */
    public onBlur: Event<void>;
    /** Event when activated (clicked, hit enter, dwell trigger). Event data is global position (game space) if done via (real) mouse/touch, null otherwise. */
    public onActivate: Event<IPoint | null>;
    public dragStart: Event<IPoint>;
    public dragMove: Event<IPoint>;
    public dragStop: Event<IPoint>;
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
    public childContext: InteractiveList | null;
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
    protected isDragging: boolean;
    protected keyStrat: KeyboardActivateStrategy;

    constructor(opts: InteractiveOpts)
    {
        this.onFocus = new Event();
        this.onBlur = new Event();
        this.onActivate = new Event();
        this.dragStart = new Event();
        this.dragMove = new Event();
        this.dragStop = new Event();
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
        this.isDragging = false;
        this.pointerOnly = !!opts.pointerOnly;
        this.keyboardOnly = !!opts.keyboardOnly;
        this.keyStrat = opts.keyControl || KeyboardActivateStrategy.Normal;
        if (this.keyStrat == KeyboardActivateStrategy.Normal)
        {
            this.keyStop.on(() => this.onActivate.emit(null));
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
            const fromMouse = NEXT_FOCUS_FROM_MOUSE;
            NEXT_FOCUS_FROM_MOUSE = false;
            this.onFocus.emit(fromMouse);
        });
        this.htmlElement.addEventListener('blur', () => this.onBlur.emit());
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

    private updateHTMLEnabled()
    {
        this.htmlElement.style.display = (this._visible && this._enabled) ? 'block' : 'none';
    }

    public updatePosition(): void
    {
        // To be overridden by specific implementations
        this.htmlElement.style.width = '10px';
        this.htmlElement.style.height = '10px';
    }

    public dispose(): void
    {
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

    public cancelDrag(): void
    {
        this.activePointerId = -1;
        this.removeWindowListeners();
    }

    public transferDrag(recipient: Interactive): void
    {
        recipient.activePointerId = this.activePointerId;
        recipient.pointerIn = true;
        recipient.isDragging = true;
        recipient.addWindowEvents();

        this.cancelDrag();
    }

    private onPointerOver(ev: PointerEvent | TouchEvent | MouseEvent)
    {
        NEXT_FOCUS_FROM_MOUSE = true;
        this.focus();
        if (this.getId(ev) == this.activePointerId)
        {
            this.pointerIn = true;
        }
    }

    private onPointerOut(ev: PointerEvent | TouchEvent | MouseEvent)
    {
        this.blur();
        if (this.getId(ev) == this.activePointerId)
        {
            this.pointerIn = false;
        }
    }

    private onPointerDown(ev: PointerEvent | TouchEvent | MouseEvent)
    {
        // console.log('pointer down', ev);
        if (this.activePointerId >= 0) return;

        this.activePointerId = this.getId(ev);
        this.pointerIn = true;

        this.addWindowEvents();

        if (this.draggable)
        {
            ev.preventDefault();
            // if we are already dragging due to sticky click, we don't need to emit anything else
            if (this.isDragging) return;

            const point = this.mapEvToPoint(ev);
            // if we are only draggable, or sticky click + a touch event, start dragging immediately
            if (this.draggable == DragStrategy.DragOnly ||
                (this.draggable == DragStrategy.DragWithStickyClick &&
                    (SUPPORTS_TOUCH && ev instanceof TouchEvent) ||
                    (SUPPORTS_POINTERS && (ev as PointerEvent).pointerType == 'touch')
                )
            )
            {
                this.isDragging = true;
                this.dragStart.emit(point);
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

    private onPointerMove(ev: PointerEvent | TouchEvent | MouseEvent)
    {
        if (this.activePointerId != this.getId(ev)) return;

        if (this.draggable)
        {
            ev.preventDefault();

            const point = this.mapEvToPoint(ev);
            if (!this.isDragging &&
                (this.draggable == DragStrategy.DragOrClick || this.draggable == DragStrategy.DragWithStickyClick))
            {
                if (distSq(point, this.dragStartPoint) >= this.minDragDistSq)
                {
                    this.isDragging = true;
                    this.dragStart.emit(this.dragStartPoint);
                }
            }
            if (this.isDragging)
            {
                this.dragMove.emit(point);
            }
        }
    }

    private onPointerUp(ev: PointerEvent | TouchEvent | MouseEvent)
    {
        // console.log('pointer up', ev);
        if (this.activePointerId != this.getId(ev)) return;

        ev.preventDefault();

        const point = this.mapEvToPoint(ev);
        if (this.isDragging)
        {
            this.isDragging = false;
            this.dragStop.emit(point);
        }
        else if (this.pointerIn)
        {
            if (this.draggable == DragStrategy.DragWithStickyClick)
            {
                this.isDragging = true;
                this.dragStart.emit(point);
            }
            else if (this.draggable != DragStrategy.DragOnly)
            {
                this.onActivate.emit(this.mapEvToPoint(ev));
            }
        }

        this.activePointerId = -1;
        this.removeWindowListeners();
    }

    private onPointerCancel(ev: PointerEvent | TouchEvent | MouseEvent)
    {
        if (this.activePointerId != this.getId(ev)) return;

        if (this.draggable)
        {
            this.dragStop.emit(this.mapEvToPoint(ev));
            this.isDragging = false;
        }

        this.activePointerId = -1;
        this.removeWindowListeners();
    }

    private getId(ev: PointerEvent | TouchEvent | MouseEvent): number
    {
        if (SUPPORTS_POINTERS && ev instanceof PointerEvent && ev.pointerId == this.activePointerId)
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

    private mapEvToPoint(ev: PointerEvent | TouchEvent | MouseEvent)
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