import { Interactive, InteractiveOpts, IPoint, } from './Interactive';
import { IRendererPlugin } from './InteractionManager';
import { globalTimer, IDisposable } from '@fablevision/utils';
import { areRectsDifferent, copyRectTo } from './internal';

const helperRect = new DOMRect();

export class HTMLInteractive extends Interactive
{
    /** The sprite object this represents */
    private objectDisplay: HTMLElement;
    private container: HTMLElement;
    private update: IDisposable;
    private lastRect: DOMRect;

    constructor(opts: InteractiveOpts & { html: HTMLElement, container: HTMLElement })
    {
        super(opts);

        this.objectDisplay = opts.html;
        this.container = opts.container;
        this.lastRect = this.objectDisplay.getBoundingClientRect();
        this.update = globalTimer.add(() =>
        {
            if (this.objectDisplay.offsetParent)
            {
                this.updatePosition();
            }
        });
    }

    public get visible(): boolean { return this._visible; }
    public set visible(visible: boolean)
    {
        if (visible) {
            this.objectDisplay.style.display = '';
        } else {
            this.objectDisplay.style.display = 'none';
        }
        super.visible = visible;
    }

    public updatePosition(): void
    {
        const div = this.htmlElement;
        const bounds = this.objectDisplay.getBoundingClientRect();
        const containerBounds = this.container.getBoundingClientRect();

        if (areRectsDifferent(helperRect, this.lastRect))
        {
            copyRectTo(bounds, this.lastRect);

            let scale = 1;
            if (this.container?.dataset?.scale) {
                scale = parseFloat(this.container.dataset.scale);
            }

            div.style.left = `${(bounds.x - containerBounds.left) / scale}px`;
            div.style.top = `${(bounds.y - containerBounds.top) / scale}px`;
            div.style.width = `${bounds.width / scale}px`;
            div.style.height = `${bounds.height / scale}px`;
        }
    }

    public hitTest(globalX: number, globalY: number): boolean
    {
        return (globalX > this.lastRect.left &&
                globalX < this.lastRect.right &&
                globalY > this.lastRect.bottom &&
                globalY < this.lastRect.top);
    }

    public get bounds() { return this.lastRect; }

    public dispose()
    {
        super.dispose();
        this.update.dispose();
    }
}

export class HTMLHandler implements IRendererPlugin
{
    private container: HTMLElement;

    constructor(container: HTMLElement)
    {
        this.container = container;
    }

    mapClientPosToPoint(x: number, y: number): IPoint
    {
        const view = this.container;
        const rect = view.getBoundingClientRect();

        let resolutionMultiplier = 1.0;
        if (this.container?.dataset?.scale) {
            resolutionMultiplier = parseFloat(this.container.dataset.scale);
        }

        return {
            x: ((x - rect.left) * (rect.width)) * resolutionMultiplier,
            y: ((y - rect.top) * (rect.height)) * resolutionMultiplier,
        };
    }
}