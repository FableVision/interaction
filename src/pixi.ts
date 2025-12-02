import { DisplayObject, Point, Rectangle } from 'pixi.js';
import { Interactive, InteractiveOpts, IPoint, } from './Interactive';
import { IRendererPlugin } from './InteractionManager';
import { globalTimer, IDisposable } from '@fablevision/utils';
import { arePointsDifferent, areRectsDifferent, copyRectTo } from './internal';

const helperRect = new Rectangle();

export interface IView
{
    width: number;
    height: number;
    getBoundingClientRect(): {width: number, height: number, top: number, left: number};
}

export interface IRenderer
{
    view: IView;
    resolution: number;
}

/**
 * PixiInteractive will attempt to keep the accessibility position synced with the pixi DisplayObject
 * if globalTimer is running/ticked. Otherwise, you'll need to call updatePosition() manually.
 */
export class PixiInteractive extends Interactive
{
    /** The pixi display object this represents */
    private pixiDisplay: DisplayObject;
    private boundsID: number;
    private update: IDisposable;
    private lastRect: Rectangle;
    private lastPos: Point;

    constructor(opts: InteractiveOpts & { pixi: DisplayObject })
    {
        super(opts);

        this.pixiDisplay = opts.pixi;
        this.boundsID = -1;
        this.lastRect = new Rectangle();
        this.lastPos = new Point(Infinity, Infinity);
        this.update = globalTimer.add(() =>
        {
            if (this.pixiDisplay.worldVisible)
            {
                this.updatePosition();
            }
        });
    }

    public get visible(): boolean { return this._visible; }
    public set visible(visible: boolean)
    {
        this.pixiDisplay.visible = visible;
        super.visible = visible;
    }

    public updatePosition(): void
    {
        // prevent updating multiple times per frame
        if (this.boundsID == (this.pixiDisplay as any)._boundsID) return;
        this.boundsID = (this.pixiDisplay as any)._boundsID;

        const div = this.htmlElement;
        const hitArea = (this.pixiDisplay as any).hitArea;
        if (this.htmlIsOverridden)
        {
            // just get the x/y of the display object, assume the user of
            // the override is keeping the override shape/element size and local position correct
            const wt = this.pixiDisplay.worldTransform;
            helperRect.x = wt.tx;
            helperRect.y = wt.ty;

            if (arePointsDifferent(helperRect, this.lastPos))
            {
                this.lastPos.copyFrom(helperRect);

                div.style.left = `${helperRect.x}px`;
                div.style.top = `${helperRect.y}px`;

                // update bounds just to support StandaloneGroup
                this.pixiDisplay.getBounds(false, this.lastRect);
            }
        }
        else if (hitArea && hitArea instanceof Rectangle)
        {
            const wt = this.pixiDisplay.worldTransform;
            helperRect.x = wt.tx + (hitArea.x * wt.a);
            helperRect.y = wt.ty + (hitArea.y * wt.d);
            helperRect.width = hitArea.width * wt.a;
            helperRect.height = hitArea.height * wt.d;

            if (areRectsDifferent(helperRect, this.lastRect))
            {
                copyRectTo(helperRect, this.lastRect);

                div.style.left = `${helperRect.x}px`;
                div.style.top = `${helperRect.y}px`;
                div.style.width = `${helperRect.width}px`;
                div.style.height = `${helperRect.height}px`;
            }
        }
        else
        {
            const bounds = this.pixiDisplay.getBounds(false, helperRect);
            if (areRectsDifferent(bounds, this.lastRect))
            {
                copyRectTo(bounds, this.lastRect);

                div.style.left = `${bounds.x}px`;
                div.style.top = `${bounds.y}px`;
                div.style.width = `${bounds.width}px`;
                div.style.height = `${bounds.height}px`;
            }
        }
    }

    public hitTest(globalX: number, globalY: number): boolean
    {
        return this.lastRect.contains(globalX, globalY);
    }

    public get bounds() { return this.lastRect; }

    public dispose()
    {
        super.dispose();
        this.update.dispose();
    }
}

export class PixiHandler implements IRendererPlugin
{
    private pixi: IRenderer;

    constructor(pixi: IRenderer)
    {
        this.pixi = pixi as any;
    }

    mapClientPosToPoint(x: number, y: number): IPoint
    {
        const view = this.pixi.view;
        const rect = view.getBoundingClientRect()!;
        const resolutionMultiplier = 1.0 / this.pixi.resolution;

        return {
            x: ((x - rect.left) * (view.width / rect.width)) * resolutionMultiplier,
            y: ((y - rect.top) * (view.height / rect.height)) * resolutionMultiplier,
        };
    }
}