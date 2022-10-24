import { globalTimer, IDisposable } from '@fablevision/utils';
import { ComplexFocusContext } from './complex';
import { InteractiveList } from './InteractionManager';
import { Interactive, InteractiveOpts } from './Interactive';
import { IRect, areRectsDifferent, copyRectTo } from './internal';

const helperRect: IRect = {x: 0, y: 0, width: 0, height: 0};

/**
 * A Group interactive with no backing display object - its bounds are exactly the bounds of its child context.
 */
export class StandaloneGroup extends Interactive
{
    /** If this focus item is a group (and should use a different focus UI as a signifier), the child context to be used upon activation */
    public childContext!: InteractiveList | ComplexFocusContext;
    private update: IDisposable;
    private lastRect: IRect;

    constructor(opts: InteractiveOpts & {childContext: InteractiveList|ComplexFocusContext})
    {
        super(opts);
        this.lastRect = {x: 0, y: 0, width: 0, height: 0};
        this.update = globalTimer.add(() =>
        {
            if (this._visible) this.updatePosition();
        });
    }

    public updatePosition(): void
    {
        const children = Array.isArray(this.childContext) ? this.childContext : this.childContext.items;
        const div = this.htmlElement;
        let maxX = Number.MIN_SAFE_INTEGER;
        let minX = Number.MAX_SAFE_INTEGER;
        let maxY = Number.MIN_SAFE_INTEGER;
        let minY = Number.MAX_SAFE_INTEGER;

        for (let i = 0; i < children.length; ++i)
        {
            const bounds = children[i].bounds;
            if (bounds.x < minX) minX = bounds.x;
            if (bounds.x + bounds.width > maxX) maxX = bounds.x + bounds.width;
            if (bounds.y < minY) minY = bounds.y;
            if (bounds.y + bounds.height > maxY) maxY = bounds.y + bounds.height;
        }
        helperRect.x = minX;
        helperRect.width = maxX - minX;
        helperRect.y = minY;
        helperRect.height = maxY - minY;

        if (areRectsDifferent(helperRect, this.lastRect))
        {
            copyRectTo(helperRect, this.lastRect);

            div.style.left = `${helperRect.x}px`;
            div.style.top = `${helperRect.y}px`;
            div.style.width = `${helperRect.width}px`;
            div.style.height = `${helperRect.height}px`;
        }
    }

    public hitTest(globalX: number, globalY: number): boolean
    {
        if (globalX < this.lastRect.x) return false;
        if (globalY < this.lastRect.y) return false;
        if (globalX > this.lastRect.x + this.lastRect.width) return false;
        return globalY < this.lastRect.y + this.lastRect.height;
    }

    public get bounds() { return this.lastRect; }

    public dispose()
    {
        super.dispose();
        this.update.dispose();
    }
}