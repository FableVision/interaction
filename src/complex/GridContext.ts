import { DisposableGroup } from '@fablevision/utils';
import { InteractionManager, InteractiveList } from '../InteractionManager';
import { Interactive } from '../Interactive';
import { Keyboard, KeyConfig } from '../Keyboard';
import { ComplexFocusContext } from './ComplexFocusContext';

export interface GridContextOpts
{
    /**
     * Grid of items, with null for any gaps. Layout should be column-first, so that the grid is
     * read with grid[x][y].
     */
    grid: (Interactive|null)[][],
    /** How tab selection should be handled -
     * * First by selecting column, then row
     * * First by selecting row, then column
     * * By selecting each item individually, no helper groups
     */
    tabSelection: 'column'|'row'|'single',
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
    /** If gaps should be jumped over when using arrow keys (or equivalent). */
    arrowSkipsGaps?: boolean;
    /** Name of this context. If omitted, generates a random one. */
    name?: string;
}

/**
 * An advanced context that creates groups and keyboard controls for grid navigation/selection
 * (in addition to just clicking on any of them).
 */
export class GridContext implements ComplexFocusContext
{
    public items: InteractiveList;
    public deactivate: DisposableGroup;
    public name: string;
    protected keyConfigs: KeyConfig[];
    protected grid: (Interactive|null)[][];
    protected gridX: number;
    protected gridY: number;

    constructor(opts: GridContextOpts)
    {
        this.grid = opts.grid;
        this.gridX = this.gridY = 0;
        this.items = [];
        switch (opts.tabSelection)
        {
            case 'column':
                break;
            case 'row':
                break;
            case 'single':
                break;
        }
        this.name = opts.name || String(Math.random());
        this.deactivate = new DisposableGroup();
        this.keyConfigs = [
            // left
            {
                keys: [],
                up: () => this.move(-1, 0),
            },
            // right
            {
                keys: [],
                up: () => this.move(1, 0),
            },
            // up
            {
                keys: [],
                up: () => this.move(0, -1),
            },
            // down
            {
                keys: [],
                up: () => this.move(0, 1),
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
                up: () => InteractionManager.instance.popContext(this.name),
            });
        }
    }

    public activate(): void
    {
        this.deactivate.add(Keyboard.instance.addQuickContext(...this.keyConfigs));
    }

    protected move(x: number, y: number): void
    {
        // TODO:
    }
}