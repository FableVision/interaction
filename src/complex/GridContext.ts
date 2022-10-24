import { DisposableGroup } from '@fablevision/utils';
import { InteractionManager, InteractiveList } from '../InteractionManager';
import { Interactive } from '../Interactive';
import { Keyboard, KeyConfig } from '../Keyboard';
import { StandaloneGroup } from '../StandaloneGroup';
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
    /** If gaps should be jumped over when using arrow keys (or equivalent). Defaults to false. */
    arrowSkipsGaps?: boolean;
    /** If arrow keys should loop around in the grid instead of stop short. Defaults to false. */
    arrowLoopsAtEdges?: boolean;
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
    protected gridWidth: number;
    protected gridHeight: number;
    protected skipGaps: boolean;
    protected loop: boolean;

    constructor(opts: GridContextOpts)
    {
        this.skipGaps = !!opts.arrowSkipsGaps;
        this.loop = !!opts.arrowLoopsAtEdges;
        this.grid = opts.grid;
        this.gridX = this.gridY = 0;
        this.gridWidth = this.grid.length;
        this.gridHeight = this.grid[0].length;
        this.items = [];
        switch (opts.tabSelection)
        {
            case 'column':
                for (let x = 0; x < this.gridWidth; ++x)
                {
                    const column: Interactive[] = [];
                    for (let y = 0; y < this.gridHeight; ++y)
                    {
                        const item = this.grid[x][y];
                        if (item)
                        {
                            column.push(item);
                        }
                    }
                    if (!column.length) continue;
                    const columnGroup = new StandaloneGroup({childContext: column});
                    this.items.push(columnGroup);
                }
                break;
            case 'row':
                for (let y = 0; y < this.gridWidth; ++y)
                {
                    const row: Interactive[] = [];
                    for (let x = 0; x < this.gridHeight; ++x)
                    {
                        const item = this.grid[x][y];
                        if (item)
                        {
                            row.push(item);
                        }
                    }
                    const rowGroup = new StandaloneGroup({childContext: row});
                    this.items.push(rowGroup);
                }
                break;
            case 'single':
                for (let x = 0; x < this.gridWidth; ++x)
                {
                    for (let y = 0; y < this.gridHeight; ++y)
                    {
                        const item = this.grid[x][y];
                        if (item)
                        {
                            this.items.push(item);
                        }
                    }
                }
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
        // TODO: handle setting gridX starting position, both in general, from individual row/column groups, and from tabbing through individuals
        let nextX = this.gridX + x;
        let nextY = this.gridY + y;
        while (!this.grid[nextX] || !this.grid[nextX][nextY])
        {
            if (nextX < 0 || nextX >= this.gridWidth || nextY < 0 || nextY >= this.gridHeight)
            {
                if (!this.loop)
                {
                    break;
                }
                if (nextX < 0) nextX = this.gridWidth - 1;
                else if (nextX >= this.gridWidth) nextX = 0;
                if (nextY < 0) nextY = this.gridHeight - 1;
                else if (nextY >= this.gridHeight) nextY = 0;
            }
            else if (this.skipGaps)
            {
                nextX += x;
                nextY += y;
            }
            else
            {
                break;
            }
        }
        if (this.grid[nextX] && this.grid[nextX][nextY])
        {
            this.gridX = nextX;
            this.gridY = nextY;
            this.grid[nextX][nextY]!.focus();
        }
    }
}