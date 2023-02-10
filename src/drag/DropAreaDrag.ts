import { DisposableGroup, DoubleEvent, Event } from '@fablevision/utils';
import { ComplexFocusContext } from '../complex';
import { InteractionManager, InteractiveList } from '../InteractionManager';
import { DragType, Interactive } from '../Interactive';
import { Keyboard } from '../Keyboard';
import { DragTarget, IDragController } from './interfaces';
import { StandardDrag } from './StandardDrag';

export interface DropAreaDragOpts<T extends DragTarget>
{
    target: T;
    interactive: Interactive;
    dropAreas: InteractiveList|ComplexFocusContext;
    /**
     * Custom hit testing for pointer-driven drags - return -1 for no area hit,
     * or any other number as an index of the drop area list.
     */
    testDropAreas?: (dropped: T) => number;
    /** Defaults to true - activating the target when keyboard dragging cancels the drag. */
    includeTarget?: boolean;
}

/**
 * A drag controller that sits atop a pointer and a keyboard group to simplify hooks within your game.
 */
export class DropAreaDrag<T extends DragTarget> implements IDragController<T, number>
{
    protected pointer: StandardDrag<T>;
    public dragStarted: DoubleEvent<T, DragType>;
    public dragComplete: DoubleEvent<T, number>;
    public dragFailed: Event<T>;
    protected dropContext: ComplexFocusContext;
    protected currentDrag: DragType;
    protected includeTarget: boolean;
    protected target: T;
    protected interactive: Interactive;
    protected dropAreaCleanup: DisposableGroup;

    constructor(opts: DropAreaDragOpts<T>)
    {
        this.target = opts.target;
        this.interactive = opts.interactive;
        this.includeTarget = opts.includeTarget !== false;
        this.currentDrag = DragType.None;
        if (Array.isArray(opts.dropAreas))
        {
            const deactivate = new DisposableGroup();
            this.dropContext = {
                items: (this.includeTarget && !opts.dropAreas.includes(this.interactive)) ? opts.dropAreas.concat(this.interactive) : opts.dropAreas,
                activate: () =>
                {
                    deactivate.add(Keyboard.instance.addQuickContext({
                        keys: Keyboard.instance.ESC,
                        up: () => InteractionManager.instance.popContext(this.dropContext.name),
                    }));
                },
                deactivate,
                // use a random name, in case there are multiple draggables *and* drop areas need to be replaced
                name: 'dragDrop' + Math.random(),
                // treat as a modal, don't allow baseline
                allowBaseline: false,
            };
        }
        else
        {
            this.dropContext = opts.dropAreas;
            if (this.includeTarget && !this.dropContext.items.includes(this.interactive))
            {
                this.dropContext = Object.assign({}, this.dropContext, {items: this.dropContext.items.concat(this.interactive)});
            }
        }
        this.dropAreaCleanup = new DisposableGroup();
        for (let i = 0; i < this.dropContext.items.length; ++i)
        {
            if (this.dropContext.items[i] === this.interactive) continue;
            this.dropAreaCleanup.add(this.dropContext.items[i].onActivate.on(() => {
                if (this.currentDrag)
                {
                    this.cancel();
                    this.dragComplete.emit(this.target, i);
                }
            }));
        }
        this.pointer = new StandardDrag({target: this.target, interactive: this.interactive});
        this.dragStarted = new DoubleEvent();
        this.dragComplete = new DoubleEvent();
        this.dragFailed = new Event();
        const start = (target: T, type: DragType) => {
            this.currentDrag = type;
            this.dragStarted.emit(target, type);
        };
        const {testDropAreas} = opts;
        const end = (target: T) => {
            this.currentDrag = DragType.None;

            if (testDropAreas)
            {
                const result = testDropAreas(target);
                if (result >= 0)
                {
                    this.dragComplete.emit(target, result);
                    return;
                }
            }
            else
            {
                // find the drop area we dropped the item on
                for (let i = 0; i < this.dropContext.items.length; ++i)
                {
                    if (this.dropContext.items[i] === this.interactive) continue;
                    // skip disabled or hidden items
                    if (!this.dropContext.items[i].visible || !this.dropContext.items[i].enabled) continue;
                    if (this.dropContext.items[i].hitTest(target.x, target.y))
                    {
                        this.dragComplete.emit(target, i);
                        return;
                    }
                }
            }
            // if we got here, we missed
            this.dragFailed.emit(target);
        };
        this.pointer.dragStarted.add(start);
        this.pointer.dragComplete.add(end);
        this.interactive.onActivate.add((position) => {
            // mouse activate shouldn't happen, because the target should be draggable.
            if (position) return;

            if (this.currentDrag)
            {
                this.currentDrag = DragType.None;
                InteractionManager.instance.popContext(this.dropContext.name);
                return;
            }
            this.currentDrag = DragType.Keyboard;
            InteractionManager.instance.activateContext(this.dropContext);
            this.dragStarted.emit(this.target, this.currentDrag);
        });
    }

    public cancel(): void
    {
        this.pointer.cancel();
        if (this.currentDrag == DragType.Keyboard)
        {
            InteractionManager.instance.popContext(this.dropContext.name);
        }
        this.currentDrag = DragType.None;
    }

    public replaceDropAreas(dropAreas: InteractiveList)
    {
        // cleanup listeners on previous drop areas
        this.dropAreaCleanup.dispose();

        // overwrite context item list
        if (this.includeTarget && !dropAreas.includes(this.interactive))
        {
            this.dropContext.items = dropAreas.concat(this.interactive);
        }
        else
        {
            this.dropContext.items = dropAreas;
        }
        // assign new listeners
        for (let i = 0; i < this.dropContext.items.length; ++i)
        {
            if (this.dropContext.items[i] === this.interactive) continue;
            this.dropAreaCleanup.add(this.dropContext.items[i].onActivate.on(() =>
            {
                if (this.currentDrag)
                {
                    this.cancel();
                    this.dragComplete.emit(this.target, i);
                }
            }));
        }

        // if our context was active, replace it
        if (InteractionManager.instance.hasContext(this.dropContext.name))
        {
            InteractionManager.instance.replaceCurrentContext(this.dropContext);
        }
    }

    public dispose(): void
    {
        this.dropAreaCleanup.dispose();
        this.pointer.dispose();
        this.dragStarted.dispose();
        this.dragComplete.dispose();
        this.dragFailed.dispose();
    }
}