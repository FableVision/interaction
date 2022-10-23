import { DisposableGroup } from '@fablevision/utils';
import { InteractionManager, InteractiveList } from '../InteractionManager';
import { Keyboard, KeyConfig } from '../Keyboard';
import { ComplexFocusContext } from './ComplexFocusContext';

export interface KeyboardShortcutContextOpts
{
    /** List of items in the context. */
    items: InteractiveList;
    /** Keyboard shortcuts to select the corresponding entry in items. Null values don't have a shortcut. */
    keys: (string[]|string|null)[];
    /** Name of this context. If omitted, generates a random one. */
    name?: string;
    /**
     * If hitting ESC should end the drag. Activating the interactive item will always end it.
     * Defaults to true
     */
    escCancels?: boolean;
}

/**
 * An advanced context that automatically activates keyboard shortcuts to select specific
 * interactable items.
 */
export class KeyboardShortcutContext implements ComplexFocusContext
{
    public items: InteractiveList;
    public deactivate: DisposableGroup;
    public keys: KeyConfig[];
    public name: string;

    constructor(opts: KeyboardShortcutContextOpts)
    {
        this.items = opts.items;
        this.name = opts.name || String(Math.random());
        this.deactivate = new DisposableGroup();
        this.keys = [];
        for (let i = 0; i < opts.keys.length; ++i)
        {
            if (!opts.keys[i]) continue;
            this.keys.push({
                keys: opts.keys[i]!,
                down: () => this.items[i].focus(),
            });
        }
        if (opts.escCancels !== false)
        {
            this.keys.push({keys: Keyboard.instance.ESC, up: () => InteractionManager.instance.popContext(this.name)});
        }
    }

    public activate(): void
    {
        this.deactivate.add(Keyboard.instance.addQuickContext(...this.keys));
    }
}