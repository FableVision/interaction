import { Disposable, DisposableGroup, IDisposable, math } from '@fablevision/utils';
import { Keyboard, KeyEvent } from './Keyboard';
import { Interactive, IPoint } from './Interactive';
import { DWELL, GROUP_CLASS, INTERACTIVE_CLASS, KEYBOARD, MOUSE, TOUCH } from './internal';
import { ComplexFocusContext } from './complex';

/** A list of focusable items that can be tabbed through in order */
export type InteractiveList = Interactive[];

export interface FullFocusContext
{
    /** A list of focusable items that can be tabbed through in order */
    items: InteractiveList;
    /** If this should be combined with the baseline context. Default is true. */
    allowBaseline?: boolean;
    /** Name for targeted removal */
    name: string;
}

export interface BaselineContext
{
    prepend: InteractiveList;
    append: InteractiveList;
}

interface InternalContext
{
    items: InteractiveList;
    allowBaseline: boolean;
    name: string;
    cleanup: DisposableGroup;
    parent: InternalContext|null;
}

export const CSS_CONFIG =
{
    normalStyle: 'solid',
    normalWidth: 10,
    groupStyle: 'double',
    groupWidth: 12,
    dwellSeconds: 2,
    dwellOffset: 20,
    color: '#FEA100',
    /** If mouse/pen triggered focus should be displayed (when not dwelling). */
    showFocusWithMouse: true,
    /** If touch triggered focus should be displayed (when not dwelling). */
    showFocusWithTouch: true,
};

function getFocusCSS(): string
{
    return `:not(svg).${INTERACTIVE_CLASS}:focus {
    outline-style: ${CSS_CONFIG.normalStyle};
    outline-width: ${CSS_CONFIG.normalWidth}px;
    outline-color: ${CSS_CONFIG.color};
}
svg.${INTERACTIVE_CLASS}:focus polyline,
svg.${INTERACTIVE_CLASS}:focus polygon,
svg.${INTERACTIVE_CLASS}:focus circle,
svg.${INTERACTIVE_CLASS}:focus ellipse,
svg.${INTERACTIVE_CLASS}:focus rectangle,
svg.${INTERACTIVE_CLASS}:focus line,
svg.${INTERACTIVE_CLASS}:focus path {
    stroke: ${CSS_CONFIG.color};
}
:not(svg).${INTERACTIVE_CLASS}.${MOUSE}:not(.${DWELL}):focus {
    outline-color: ${CSS_CONFIG.showFocusWithMouse ? CSS_CONFIG.color : 'transparent'};
}
svg.${INTERACTIVE_CLASS}.${MOUSE}:not(.${DWELL}):focus polyline,
svg.${INTERACTIVE_CLASS}.${MOUSE}:not(.${DWELL}):focus polygon,
svg.${INTERACTIVE_CLASS}.${MOUSE}:not(.${DWELL}):focus circle,
svg.${INTERACTIVE_CLASS}.${MOUSE}:not(.${DWELL}):focus ellipse,
svg.${INTERACTIVE_CLASS}.${MOUSE}:not(.${DWELL}):focus rectangle,
svg.${INTERACTIVE_CLASS}.${MOUSE}:not(.${DWELL}):focus line,
svg.${INTERACTIVE_CLASS}.${MOUSE}:not(.${DWELL}):focus path {
    stroke: ${CSS_CONFIG.showFocusWithMouse ? CSS_CONFIG.color : 'none'};
}
:not(svg).${INTERACTIVE_CLASS}.${TOUCH}:not(.${DWELL}):focus {
    outline-color: ${CSS_CONFIG.showFocusWithTouch ? CSS_CONFIG.color : 'transparent'};
}
svg.${INTERACTIVE_CLASS}.${TOUCH}:not(.${DWELL}):focus polyline,
svg.${INTERACTIVE_CLASS}.${TOUCH}:not(.${DWELL}):focus polygon,
svg.${INTERACTIVE_CLASS}.${TOUCH}:not(.${DWELL}):focus circle,
svg.${INTERACTIVE_CLASS}.${TOUCH}:not(.${DWELL}):focus ellipse,
svg.${INTERACTIVE_CLASS}.${TOUCH}:not(.${DWELL}):focus rectangle,
svg.${INTERACTIVE_CLASS}.${TOUCH}:not(.${DWELL}):focus line,
svg.${INTERACTIVE_CLASS}.${TOUCH}:not(.${DWELL}):focus path {
    stroke: ${CSS_CONFIG.showFocusWithMouse ? CSS_CONFIG.color : 'none'};
}
:not(svg).${INTERACTIVE_CLASS}.${GROUP_CLASS}:focus {
    outline-style: ${CSS_CONFIG.groupStyle} !important;
    outline-width: ${CSS_CONFIG.groupWidth}px !important;
}

svg.${INTERACTIVE_CLASS} {
    /* disable interaction with the whole rectangle */
    pointer-events: none;
    /* hide built in outline */
    outline: none;
    /* allow outlines/strokes to go outside view box */
    overflow: visible;
}

svg.${INTERACTIVE_CLASS} polygon,
svg.${INTERACTIVE_CLASS} circle,
svg.${INTERACTIVE_CLASS} ellipse,
svg.${INTERACTIVE_CLASS} rectangle,
svg.${INTERACTIVE_CLASS} path {
    pointer-events: all;
    /* invisible until we use the stroke to do the highlight */
    stroke: none;
}

svg.${INTERACTIVE_CLASS} polyline,
svg.${INTERACTIVE_CLASS} line {
    pointer-events: stroke;
    /* invisible until we use the stroke to do the highlight */
    stroke: none;
}

.${INTERACTIVE_CLASS} {
    /* Prevent browser from interfering with our drags */
    touch-action: none;
}

:not(svg).${INTERACTIVE_CLASS}.${DWELL} {
    animation-duration: ${CSS_CONFIG.dwellSeconds}s;
    animation-name: dwell-activate;
}

@keyframes dwell-activate {
    from {
        outline-offset: ${CSS_CONFIG.dwellOffset}px;
    }

    to {
        outline-offset: 0px;
    }
}
`;
}

export enum GroupEndStrategy
// eslint-disable-next-line @typescript-eslint/indent
{
    Loop = 'loop',
    Exit = 'exit',
}

export enum ControlStrategy
// eslint-disable-next-line @typescript-eslint/indent
{
    /** Rely solely on native browser controls */
    BrowserNative = 'default',
    /**
     * Override default behavior of tab/shift+tab keys, to keep the user from getting to the browser UI.
     * ESC key, when not in a sub-group, disables the lock-in and restores default browser controls.
     * Interaction with game elements after that will re-enable lock-in.
     */
    LockedIn = 'lockEsc',
    /**
     * Override default behavior of tab/shift+tab keys, to keep the user from getting to the browser UI.
     * ESC key does not disable the lock.
     */
    LockedInNoEsc = 'lock',
}

export interface IRendererPlugin
{
    mapClientPosToPoint(x: number, y: number): IPoint;
}

export interface InteractionManagerOpts
{
    /** Element or element id of the div to place interactive elements inside. */
    accessibilityDiv: string|HTMLElement;
    /** Renderer plugin, for forcing transform updates and calculating positions */
    renderer: IRendererPlugin;
    /** What to do when tabbing past the end of a subgroup (not a full context). Defaults to exiting. */
    groupEnd?: GroupEndStrategy;
    /** How to handle tab controls. Defaults to browser native controls. */
    control?: ControlStrategy;
    /** If focus & blur should still function when the InteractionManager is disabled. */
    focusWhenDisabled?: boolean;
    /**
     * If the interaction manager should automatically pop back to parent contexts when an item not in the current context
     * is interacted with. It would probably be good to have this be true all the time, but is new/experimental and I don't
     * want to break anything.
     */
    autoPopOnParentInteraction?: boolean;
}

export class InteractionManager
{
    private static _instance: InteractionManager|null = null;
    public static get instance(): InteractionManager
    {
        return this._instance!;
    }

    /** If the focus manager is enabled. The game will disable it automatically during loading screens. */
    public enabled = false;
    public useDwell: boolean = false;
    public renderer: IRendererPlugin;
    private focusWhenDisabled: boolean;
    /** Baseline context that is added to all contexts, unless told not to */
    private baselineContext: BaselineContext;
    /** Stack of explicit contexts */
    private contexts: InternalContext[] = [];
    /** The combined current context - items for the main context, extendedFamily for parents/children that are mouse only */
    private currentContext: {items: InteractiveList, extendedFamily:InteractiveList|null}|null = null;
    /** Listener cleanup for the current context */
    private currentDisposable: DisposableGroup;
    private current: Interactive|null = null;
    private styleElement: HTMLStyleElement;
    private htmlContainer: HTMLElement;
    private dwellTimeout: number = 0;
    private groupEnd: GroupEndStrategy;
    private controls: ControlStrategy;
    private controlsListener: Disposable|null;
    private autoPop: boolean;
    private itemsWeAttached: WeakSet<Interactive>;

    constructor(opts: InteractionManagerOpts)
    {
        InteractionManager._instance = this;

        this.groupEnd = opts.groupEnd || GroupEndStrategy.Exit;
        this.controls = opts.control || ControlStrategy.BrowserNative;
        this.controlsListener = null;
        this.focusWhenDisabled = !!opts.focusWhenDisabled;
        this.autoPop = !!opts.autoPopOnParentInteraction;
        this.itemsWeAttached = new WeakSet();

        this.renderer = opts.renderer;
        if (typeof opts.accessibilityDiv == 'string')
        {
            this.htmlContainer = document.querySelector('#' + opts.accessibilityDiv)!;
        }
        else
        {
            this.htmlContainer = opts.accessibilityDiv;
        }

        this.baselineContext = { prepend: [], append: [] };

        // because we add this when the game starts up, without any keyboard context, these
        // handlers get called in any and all contexts
        const keyboard = Keyboard.instance;
        keyboard.addGlobal(
            {keys: [keyboard.ESC], down: this.handleEsc.bind(this)},
            {keys: ['enter', 'space'], down: this.activateKeyDown, up: this.activateKeyUp},
        );
        if (this.controls != ControlStrategy.BrowserNative)
        {
            this.attachControls();
        }

        this.styleElement = document.createElement('style');
        document.head.appendChild(this.styleElement);

        this.currentDisposable = new DisposableGroup();

        this.reset();
    }

    private attachControls()
    {
        if (this.controlsListener)
        {
            this.controlsListener.dispose();
        }
        this.controlsListener = Keyboard.instance.addGlobal(
            {keys: ['tab'], down: this.next.bind(this)},
            {keys: ['shift + tab'], down: this.prev.bind(this)},
        );
    }

    private detachControls()
    {
        if (this.controlsListener)
        {
            this.controlsListener.dispose();
            this.controlsListener = null;
        }
    }

    private get isLockedIn()
    {
        return !!this.controlsListener;
    }

    /** Clears focus contexts */
    public reset(): void
    {
        this.clearContexts();
        this.updateCSS();
    }

    /**
     * Updates style css for controlling focus indicators. Call this if you change CSS_CONFIG values.
     */
    public updateCSS(): void
    {
        this.removeCSS();
        this.styleElement.appendChild(document.createTextNode(getFocusCSS()));
    }

    /**
     * Removes the style css entirely, allowing replacement with updated or custom values.
     */
    public removeCSS(): void
    {
        while (this.styleElement.childNodes.length)
        {
            this.styleElement.removeChild(this.styleElement.childNodes[0]);
        }
    }

    private activate = () =>
    {
        if (!this.enabled) return;

        if (this.current && !this.current.isBeingHeld)
        {
            this.current.onActivate.emit(null);

            // since we are interacting with the game, lock the player back in
            if (this.controls == ControlStrategy.LockedIn && !this.isLockedIn)
            {
                this.attachControls();
            }
        }
    };

    private activateKeyDown = () =>
    {
        if (!this.enabled) return;

        if (this.current)
        {
            this.current.internalOnEarly.emit(this.current);
            this.current.keyStart.emit();

            // since we are interacting with the game, lock the player back in
            if (this.controls == ControlStrategy.LockedIn && !this.isLockedIn)
            {
                this.attachControls();
            }
        }
    };

    private activateKeyUp = () =>
    {
        if (!this.enabled) return;

        if (this.current)
        {
            this.current.keyStop.emit();

            // since we are interacting with the game, lock the player back in
            if (this.controls == ControlStrategy.LockedIn && !this.isLockedIn)
            {
                this.attachControls();
            }
        }
    };

    /** The currently highlighted item */
    public get focused(): Interactive|null
    {
        return this.current;
    }

    /**
     * Sets the focus to the currently highlighted item. This is the same as calling focus() on the given target.
     */
    public set focused(target: Interactive|null)
    {
        if (target !== this.current)
        {
            if (this.current)
            {
                this.current.blur();
            }
            if (target)
            {
                target.focus();
            }
        }
    }

    /** For internal use - should focus be handled. Value is computed with the enabled and focusWhenDisabled properties. */
    public get focusEnabled(): boolean
    {
        return this.enabled || this.focusWhenDisabled;
    }

    private onFocused(target: Interactive)
    {
        if (!this.focusEnabled) return;

        this.current = target;
        target.htmlElement.classList.add(target.focusSource);

        if (!this.enabled) return;

        if ((target.alwaysDwell || this.useDwell) && !target.isBeingHeld)
        {
            this.dwellTimeout = setTimeout(this.activate, CSS_CONFIG.dwellSeconds * 1000) as any;
            target.htmlElement.classList.add(DWELL);
        }
    }

    private onBlurred(target: Interactive)
    {
        if (this.current == target)
        {
            this.current = null;
            if (this.dwellTimeout)
            {
                clearTimeout(this.dwellTimeout);
                this.dwellTimeout = 0;
            }
            target.htmlElement.classList.remove(DWELL, MOUSE, TOUCH, KEYBOARD);
        }
    }

    private handleEsc()
    {
        if (!this.contexts.length) return;

        const activeContext = this.contexts[this.contexts.length - 1];
        if (activeContext?.parent)
        {
            this.popContext();
        }
        else if (this.controls == ControlStrategy.LockedIn && this.isLockedIn)
        {
            this.detachControls();
        }
        else
        {
            this.clearFocus();
        }
    }

    private next(e: KeyEvent)
    {
        if (!this.focusEnabled) return;
        e.preventDefault();

        const context = this.currentContext?.items;
        if (!context)
        {
            return;
        }

        let current = this.current;
        if (context.length == 1)
        {
            current = context[0];
        }
        else
        {
            do
            {
                // if current is null, index will be -1, and immediately increased to 0
                let index = context.indexOf(current!);
                if (++index >= context.length)
                {
                    index = 0;
                }
                current = context[index];
            } while (!current || !current.focusable || current.pointerOnly);
        }
        // clear previous focus, select new focus
        this.focused = current;
    }

    private prev(e: KeyEvent)
    {
        if (!this.focusEnabled) return;
        e.preventDefault();

        const context = this.currentContext?.items;
        if (!context)
        {
            return;
        }

        let current = this.current;
        if (context.length == 1)
        {
            current = context[0];
        }
        else
        {
            do
            {
                // if current is null, index will be -1, and immediately decreased to -2, and then
                // set to the last index in the array
                let index = context.indexOf(current!);
                if (--index < 0)
                {
                    index = context.length - 1;
                }
                // select new focus
                current = context[index];
            } while (!current || !current.focusable || current.pointerOnly);
        }
        // clear previous focus, select new focus
        this.focused = current;
    }

    /**
     * Removes focus from the currently highlighted item.
     */
    public clearFocus(): void
    {
        this.current?.blur();
        this.current = null;
    }

    public hasContext(name: string): boolean
    {
        return this.contexts.some(c => c.name === name);
    }

    public flattenContextGrid(context: InteractiveList[]): InteractiveList
    {
        return context.reduce((prev, current) => prev.concat(current), []);
    }

    /**
     * Overrides the current context with a new context (and clears focus)
     * @param context The list of items to tab through.
     * @param asChild If the context should be activated as a child context -
     * the parent context will remain active to mouse interactions, but not tab focusing.
     */
    public activateContext(context: InteractiveList | FullFocusContext | ComplexFocusContext, asChild?: boolean): void
    {
        if (Array.isArray(context))
        {
            context = {
                items: context,
                allowBaseline: true,
                name: math.randInt(0, 100000).toString(),
            };
        }
        this.internalActivate(context, asChild ? this.contexts[this.contexts.length - 1] : null);
    }

    private internalActivate(context: FullFocusContext | ComplexFocusContext, parent: InternalContext|null)
    {
        this.clearFocus();
        if (this.contexts.find(c => c.name === context.name))
        {
            // remove anything on top of the old context
            this.popContext(context.name, false);
            // replace context items with what was just given to us
            this.replaceCurrentContext(context);
            return;
        }
        const internal: InternalContext = {
            items: context.items,
            allowBaseline: context.allowBaseline ?? true,
            name: context.name,
            cleanup: new DisposableGroup(),
            parent,
        };
        if ('activate' in context && 'deactivate' in context)
        {
            context.activate();
            internal.cleanup.add(context.deactivate);
        }
        this.contexts.push(internal);
        this.generateContext(internal);
    }

    public enterGroup(item: Interactive, overrideContext?: InteractiveList | ComplexFocusContext): string
    {
        if (!overrideContext && (!item.childContext || (Array.isArray(item.childContext) && !item.childContext.length))) return '';
        // enter non-baseline context of just the item's children
        const tempName = String(Math.random());
        let context = overrideContext || item.childContext!;
        let first = 0;
        const setUpExit = Array.isArray(context) ? this.groupEnd == GroupEndStrategy.Exit : context.exitRule == GroupEndStrategy.Exit;
        // if we need to set up exit, or handle simple array of items
        if (setUpExit || Array.isArray(context))
        {
            const items = Array.isArray(context) ? context.slice() : context.items.slice();
            let groupExit: Interactive[]|null = null;
            if (setUpExit)
            {
                // adjust index of first item
                first++;
                groupExit = [
                    new Interactive({
                        keyboardOnly: true,
                    }),
                    new Interactive({
                        keyboardOnly: true,
                    }),
                ];
                // when this item is focused, pop the context and focus on the group parent again
                groupExit[0].onFocus.add(() => {
                    this.popContext();
                    item.focus();
                });
                groupExit[1].onFocus.add(() => {
                    this.popContext();
                    item.focus();
                });
                // bracket the group with an exiter on each side
                items.unshift(groupExit[0]);
                items.push(groupExit[1]);
            }
            let modifiedContext: FullFocusContext;
            if (Array.isArray(context))
            {
                modifiedContext = { items, allowBaseline: false, name: tempName };
            }
            else
            {
                modifiedContext = Object.assign({}, context, {items});
            }
            this.internalActivate(modifiedContext, this.contexts[this.contexts.length - 1]);
            const newContext = this.contexts[this.contexts.length - 1];
            newContext.cleanup.add(Keyboard.instance.add(Keyboard.instance.ESC, () => this.popContext(tempName)));
            if (groupExit)
            {
                newContext.cleanup.add(...groupExit);
            }
            // focus on the first item, to get past the potential group exit at the start
            items[first].focus();
        }
        else
        {
            this.internalActivate(context, this.contexts[this.contexts.length - 1]);
        }
        return tempName;
    }

    /**
     * Removes the most recently added context (and clears focus)
     * @param name Name of context to pop to. If omitted, removes the single top context.
     * If the named context can't be found, no context is removed.
     * @param keepNamed If the named context should not be removed, but instead reactivated and only the things on top of it
     * removed. Defaults to false.
     */
    public popContext(name?: string, keepNamed = false): void
    {
        this.clearFocus();
        if (name)
        {
            const index = this.contexts.findIndex(c => c.name === name);
            if (index < 0)
            {
                return;
            }
            const target = !keepNamed ? index : index + 1;
            const toDispose: IDisposable[] = [];
            for (let i = target; i < this.contexts.length; ++i)
            {
                toDispose.push(this.contexts[i].cleanup);
            }
            this.contexts.length = target;
            for (let i = 0; i < toDispose.length; ++i)
            {
                toDispose[i].dispose();
            }
        }
        else
        {
            this.contexts.pop()?.cleanup.dispose();
        }
        if (!this.contexts.length)
        {
            this.generateBlankWithBaseline();
        }
        else
        {
            const last = this.contexts[this.contexts.length - 1];
            this.generateContext(last);
        }
    }

    /** Removes all contexts (useful for cleanup) */
    public clearContexts(): void
    {
        this.clearFocus();
        this.contexts.length = 0;
        this.generateBlankWithBaseline();
    }

    public setBaseline(prepend: InteractiveList, append: InteractiveList): void
    {
        this.baselineContext = { prepend, append };
        if (!this.contexts.length)
        {
            this.generateBlankWithBaseline();
        }
        else if (this.contexts[this.contexts.length - 1].allowBaseline)
        {
            this.generateContext(this.contexts[this.contexts.length - 1]);
        }
    }

    private removeCurrentContext(keep?: Interactive): void
    {
        if (!this.currentContext) return;
        this.currentDisposable.reset();
        let list = this.currentContext.items;
        for (let i = 0; i < list.length; ++i)
        {
            const item = list[i];
            if (item != keep)
            {
                item.htmlElement.remove();
            }
        }
        if (this.currentContext.extendedFamily)
        {
            list = this.currentContext.extendedFamily;
            for (let i = 0; i < list.length; ++i)
            {
                const item = list[i];
                if (item != keep)
                {
                    item.htmlElement.remove();
                }
            }
        }
    }

    private generateBlankWithBaseline()
    {
        this.generateContext({
            items: [],
            allowBaseline: true,
            parent: null,
            name: '___blank',
            cleanup: new DisposableGroup(),
        });
    }

    private generateContext(current: InternalContext): void
    {

        let list: Interactive[];
        if (current.allowBaseline)
        {
            list = [...this.baselineContext.prepend, ...current.items, ...this.baselineContext.append];
        }
        else
        {
            list = current.items.slice();
        }

        // remove anything currently there, keeping the current focus item if it is staying in the main context
        this.removeCurrentContext((this.current && list.includes(this.current)) ? this.current : undefined);

        this.currentContext = {items: list, extendedFamily: null};
        const added = list.slice();
        const fullFamily: InteractiveList = [];
        for (let i = 0; i < list.length; ++i)
        {
            const item = list[i];
            item.manager = this;
            item.updatePosition();
            this.htmlContainer.appendChild(item.htmlElement);
            item.htmlElement.tabIndex = item.pointerOnly ? -1 : i + 1;
            this.currentDisposable.add(item.onFocus.add(() => this.onFocused(item)));
            this.currentDisposable.add(item.onBlur.add(() => this.onBlurred(item)));

            if (this.autoPop)
            {
                if (!this.itemsWeAttached.has(item))
                {
                    this.itemsWeAttached.add(item);
                    item.internalOnEarly.on(this.popToItem);
                }
            }

            if (item.childContext)
            {
                this.currentDisposable.add(item.onActivate.add(() => this.enterGroup(item)));
                this.recursiveAddChildren(item, added, fullFamily);
            }
        }
        this.recursiveAddParents(current, added, fullFamily);
        if (fullFamily.length)
            this.currentContext.extendedFamily = fullFamily;
    }

    private recursiveAddChildren(item: Interactive, existingList: InteractiveList, fullFamily: InteractiveList)
    {
        if (!item.childContext) return;
        const items = Array.isArray(item.childContext) ? item.childContext : item.childContext.items;
        // children need to be added for clicks, but shouldn't be accessible via keyboard
        // in order to simplify keyboard order
        for (const child of items)
        {
            if (this.autoPop)
            {
                if (!this.itemsWeAttached.has(child))
                {
                    this.itemsWeAttached.add(child);
                    child.internalOnEarly.on(this.popToItem);
                }
            }
            if (child.isGroup)
            {
                this.recursiveAddChildren(child, existingList, fullFamily);
            }
            if (existingList.includes(child) || child.isGroup || child.keyboardOnly) continue;

            existingList.push(child);
            fullFamily.push(child);
            child.manager = this;
            this.htmlContainer.appendChild(child.htmlElement);
            // set tab index to -1 to allow use by focus() but not tab
            child.htmlElement.tabIndex = -1;
            this.currentDisposable.add(child.onFocus.add(() => this.onFocused(child)));
            this.currentDisposable.add(child.onBlur.add(() => this.onBlurred(child)));
        }
    }

    private recursiveAddParents(current: InternalContext, existingList: InteractiveList, fullFamily: InteractiveList)
    {
        // if this is part of a parent context, then keep the parent context enabled but with
        // no keyboard access
        if (current.parent)
        {
            for (const item of current.parent.items)
            {
                if (this.autoPop)
                {
                    if (!this.itemsWeAttached.has(item))
                    {
                        this.itemsWeAttached.add(item);
                        item.internalOnEarly.on(this.popToItem);
                    }
                }
                if (item.childContext)
                {
                    this.recursiveAddChildren(item, existingList, fullFamily);
                }
                if (existingList.includes(item) || item.isGroup || item.keyboardOnly) continue;

                existingList.push(item);
                fullFamily.push(item);
                this.htmlContainer.appendChild(item.htmlElement);
                // set tab index to -1 to allow use by focus() but not tab
                item.htmlElement.tabIndex = -1;
                this.currentDisposable.add(item.onFocus.add(() => this.onFocused(item)));
                this.currentDisposable.add(item.onBlur.add(() => this.onBlurred(item)));
            }
            this.recursiveAddParents(current.parent, existingList, fullFamily);
        }
    }

    /**
     * @param newContext The new context to replace the current context with.
     */
    public replaceCurrentContext(newContext: FullFocusContext): void
    {
        let current: InternalContext|undefined;
        if (newContext.name)
        {
            current = this.contexts.find(c => c.name === newContext.name);
        }
        else
        {
            current = this.contexts[this.contexts.length - 1];
        }
        // if there is no current context to replace, just activate the new one
        if (!current)
        {
            this.activateContext(newContext);
            return;
        }
        // if the replaced context is the active one
        const isActive = this.contexts[this.contexts.length - 1] === current;
        if (isActive)
        {
            this.removeCurrentContext((this.current && newContext.items.includes(this.current)) ? this.current : undefined);
        }
        current.items = newContext.items;
        if (isActive)
        {
            this.generateContext(current);
        }
        if (!this.currentContext!.items.includes(this.current!))
        {
            this.clearFocus();
        }
    }

    private popToItem = (item: Interactive) =>
    {
        if (!this.currentContext || this.currentContext.items.includes(item)) return;

        seenItemsHelper.clear();
        // if a child of the current thing, then
        if (isInListOrChild(item, this.currentContext.items))
        {
            seenItemsHelper.clear();
            return;
        }
        let foundContext: string|null = null;
        for (let i = this.contexts.length - 2; i >= 0; --i)
        {
            if (isInListOrChild(item, this.contexts[i].items))
            {
                foundContext = this.contexts[i].name;
                break;
            }
            if (!this.contexts[i].parent)
                break;
        }
        if (foundContext)
            this.popContext(foundContext, true);
    }
}

const seenItemsHelper = new Set();
function isInListOrChild(target: Interactive, items: InteractiveList): boolean
{
    for (let i = items.length - 1; i >= 0; --i)
    {
        const item = items[i];
        if (seenItemsHelper.has(item)) continue;

        if (item == target) return true;
        seenItemsHelper.add(item);
        const children = item.childContext;
        if (children)
        {
            if (isInListOrChild(target, Array.isArray(children) ? children : children.items))
                return true;
        }
    }
    return false;
}