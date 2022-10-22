import type { DisplayObject } from '@pixi/display';
import { Rectangle } from '@pixi/math';
import { AbstractRenderer } from '@pixi/core';
import { Interactive, InteractiveOpts, IPoint, } from './Interactive';
import { IRendererPlugin } from './InteractionManager';
import { globalTimer, IDisposable } from '@fablevision/utils';

const helperRect = new Rectangle();

function areRectsDifferent(a: Rectangle, b: Rectangle)
{
    return a.x != b.x || a.y != b.y || a.width != b.width || a.height != b.height;
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

    constructor(opts: InteractiveOpts & { pixi: DisplayObject })
    {
        super(opts);

        this.pixiDisplay = opts.pixi;
        this.boundsID = -1;
        this.lastRect = new Rectangle();
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
        if (hitArea && hitArea instanceof Rectangle)
        {
            const wt = this.pixiDisplay.worldTransform;
            helperRect.x = wt.tx + (hitArea.x * wt.a);
            helperRect.y = wt.ty + (hitArea.y * wt.d);
            helperRect.width = hitArea.width * wt.a;
            helperRect.height = hitArea.height * wt.d;

            if (areRectsDifferent(helperRect, this.lastRect))
            {
                this.lastRect.copyFrom(helperRect);

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
                this.lastRect.copyFrom(bounds);

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

    public dispose()
    {
        super.dispose();
        this.update.dispose();
    }
}

export class PixiHandler implements IRendererPlugin
{
    private pixi: AbstractRenderer;

    constructor(pixi: AbstractRenderer)
    {
        this.pixi = pixi;
    }

    mapClientPosToPoint(x: number, y: number): IPoint
    {
        const view = this.pixi.view;
        const rect = view.getBoundingClientRect();
        const resolutionMultiplier = 1.0 / this.pixi.resolution;

        return {
            x: ((x - rect.left) * (view.width / rect.width)) * resolutionMultiplier,
            y: ((y - rect.top) * (view.height / rect.height)) * resolutionMultiplier,
        };
    }

    forceTransformUpdate(): void
    {
        if (this.pixi._lastObjectRendered)
        {
            // ensure all transforms are updated so that positioning is correct for bounds
            const displayObject = this.pixi._lastObjectRendered;
            const cacheParent = displayObject.enableTempParent();
            displayObject.updateTransform();
            displayObject.disableTempParent(cacheParent);
        }
    }
}