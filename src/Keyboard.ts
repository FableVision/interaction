import KeyboardJS from 'keyboardjs';
import { Disposable, DisposableGroup } from '@fablevision/utils';
import KeyEvent = KeyboardJS.KeyEvent;

export { KeyEvent };

interface InternalKeyConfig
{
    /** Name(s) of keys to listen to. */
    keys: string|string[];
    /** Listener for when key is pressed down or repeated. */
    down?: (e: KeyboardJS.KeyEvent) => void;
    /** Listener for when key is released. */
    up?: (e: KeyboardJS.KeyEvent) => void;
}

// Thanks, https://stackoverflow.com/a/49725198
type RequireAtLeastOne<T, Keys extends keyof T = keyof T> =
    Pick<T, Exclude<keyof T, Keys>>
    & {
        [K in Keys]-?: Required<Pick<T, K>> & Partial<Pick<T, Exclude<Keys, K>>>
    }[Keys];

/**
 * KeyConfig is an object with a 'keys' property (string/string[]), and at least one of:
 * * 'down' - callback for when key is pressed down/repeated.
 * * 'up' - callback for when key is released.
 */
export type KeyConfig = RequireAtLeastOne<InternalKeyConfig, 'down'|'up'>;

export function fromKey(key: string|string[], down?: null|((e: KeyboardJS.KeyEvent)=>void), up?: (e: KeyboardJS.KeyEvent)=>void): Disposable
{
    const context = KeyboardJS.getContext();

    KeyboardJS.bind(key, down as any, up as any);
    return new Disposable(() =>
    {
        const prev = KeyboardJS.getContext();
        // have to remove listeners from the context they exist in
        KeyboardJS.setContext(context);
        KeyboardJS.unbind(key, down as any, up as any);
        // restore previous context
        KeyboardJS.setContext(prev);
    });
}

export class Keyboard
{
    private static _instance: Keyboard|null = null;
    public static get instance(): Keyboard
    {
        return this._instance!;
    }

    private contextStack: string[];
    private baseContext: string;

    /* eslint-disable @typescript-eslint/naming-convention */
    public readonly ESC = 'esc';
    public readonly UP = 'up';
    public readonly DOWN = 'down';
    public readonly LEFT = 'left';
    public readonly RIGHT = 'right';
    public readonly TAB = 'tab';
    /* eslint-enable @typescript-eslint/naming-convention */

    constructor()
    {
        Keyboard._instance = this;

        this.contextStack = [];

        KeyboardJS.watch();
        this.baseContext = KeyboardJS.getContext();
    }

    public pause(): void
    {
        KeyboardJS.pause();
    }

    public resume(): void
    {
        KeyboardJS.resume();
    }

    /**
     * Adds a single listener for a single key combo or set of key combos.
     * @param config Key configuration object.
     */
    public add(config: KeyConfig): Disposable;
    /**
     * Adds a single listener for a single key combo or set of key combos.
     * @param key Name(s) of keys to listen to.
     * @param down Listener for when key is pressed down or repeated.
     * @param up Listener for when key is released.
     * @return A Disposable to remove this listener.
     */
    public add(key: string | string[], down?: (e?: KeyboardJS.KeyEvent) => void, up?: (e?: KeyboardJS.KeyEvent) => void): Disposable;
    public add(key: string | string[] | KeyConfig, down?: (e?: KeyboardJS.KeyEvent) => void, up?: (e?: KeyboardJS.KeyEvent) => void): Disposable
    {
        if (typeof key === 'string' || Array.isArray(key))
        {
            return fromKey(key, down || null, up);
        }
        else
        {
            return fromKey(key.keys, key.down, key.up);
        }
    }

    /**
     * Adds a number of key listeners that are only active in a given keyboard context.
     * @param context Name of the context to add listeners to
     * @param configs List of KeyConfigs to add to the context.
     * @return Disposable to remove all of the listeners added.
     */
    public addForContext(context: string, ...configs: KeyConfig[]): DisposableGroup
    {
        const rtn = new DisposableGroup();
        KeyboardJS.withContext(context, () =>
        {
            for (const config of configs)
            {
                rtn.add(fromKey(config.keys, config.down, config.up));
            }
        });
        return rtn;
    }

    /**
     * Adds a number of key listeners that are only active in the global (always active) context.
     * @param configs List of KeyConfigs to add.
     * @return Disposable to remove all of the listeners added.
     */
    public addGlobal(...configs: KeyConfig[]): DisposableGroup
    {
        return this.addForContext(this.baseContext, ...configs);
    }

    /**
     * Adds a number of key listeners that are only active in a temporary context created and activated
     * immediately.
     * @param configs List of KeyConfigs to add.
     * @return Disposable to remove all of the listeners added and pop the temporary context.
     */
    public addQuickContext(...configs: KeyConfig[]): Disposable
    {
        const name = String(Math.random());
        const listeners = this.addForContext(name, ...configs);
        listeners.add(new Disposable(() => this.popContext(name)));
        return listeners;
    }

    /**
     * Activates a keyboard context, adding it to the stack. If it already exists in the stack, then contexts
     * above it are popped off.
     * @param context The name of the context to activate.
     */
    public activateContext(context:string): void
    {
        const index = this.contextStack.indexOf(context);
        if (index >= 0)
        {
            this.popContext(context, false);
            return;
        }
        this.contextStack.push(context);
        KeyboardJS.setContext(context);
    }

    /**
     * Pops the last keyboard context off the stack, optionally popping all the way to a given context.
     * @param name The context to go to, popping off any contexts above it. If omitted, the context on top is removed.
     * If the named context can't be found, no context is removed.
     * @param keepNamed If the named context should not be removed, but instead reactivated and only the things on top of it
     * removed. Defaults to false
     */
    public popContext(name?:string, keepNamed = false): void
    {
        if (name)
        {
            const index = this.contextStack.indexOf(name);
            if (index < 0)
            {
                return;
            }
            this.contextStack.length = !keepNamed ? index : index + 1;
        }
        else
        {
            this.contextStack.pop();
        }

        if (this.contextStack.length)
        {
            KeyboardJS.setContext(this.contextStack[this.contextStack.length - 1]);
        }
        else
        {
            KeyboardJS.setContext(this.baseContext);
        }
    }

    /**
     * Clears all contexts and returns to the basic global context.
     */
    public clearContexts(): void
    {
        this.contextStack.length = 0;
        KeyboardJS.setContext(this.baseContext);
    }
}