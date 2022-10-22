import { DisposableGroup } from '@fablevision/utils';
import { InteractionManager, InteractiveList } from '../InteractionManager';
import { Keyboard, KeyConfig } from '../Keyboard';
import { ComplexFocusContext } from './ComplexFocusContext';

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

    constructor(items: InteractiveList, keys: (string[]|string|null)[], name = String(Math.random()), escCancels = false)
    {
        this.items = items;
        this.name = name;
        this.deactivate = new DisposableGroup();
        this.keys = [];
        for (let i = 0; i < keys.length; ++i)
        {
            if (!keys[i]) continue;
            this.keys.push({
                keys: keys[i]!,
                down: () => items[i].focus(),
            });
        }
        if (escCancels)
        {
            this.keys.push({keys: Keyboard.instance.ESC, up: () => InteractionManager.instance.popContext(this.name)});
        }
    }

    public activate(): void
    {
        this.deactivate.add(Keyboard.instance.addQuickContext(...this.keys));
    }
}