import type { DisplayObject } from '@pixi/display';
import { Rectangle } from '@pixi/math';
import { AbstractRenderer } from '@pixi/core';
import { Interactive, InteractiveOpts, IPoint, } from './Interactive';
import { IRendererPlugin } from './InteractionManager';

export class PixiInteractive extends Interactive
{
    /** The pixi display object this represents */
    private pixiDisplay: DisplayObject;

    constructor(opts: InteractiveOpts & { pixi: DisplayObject })
    {
        super(opts);

        this.pixiDisplay = opts.pixi;
    }

    public get visible(): boolean { return this._visible; }
    public set visible(visible: boolean)
    {
        this.pixiDisplay.visible = visible;
        super.visible = visible;
    }

    public updatePosition(): void
    {
        const div = this.htmlElement;
        const hitArea = (this.pixiDisplay as any).hitArea;
        if (hitArea && hitArea instanceof Rectangle)
        {
            const wt = this.pixiDisplay.worldTransform;
            div.style.left = `${wt.tx + (hitArea.x * wt.a)}px`;
            div.style.top = `${wt.ty + (hitArea.y * wt.d)}px`;

            div.style.width = `${hitArea.width * wt.a}px`;
            div.style.height = `${hitArea.height * wt.d}px`;
        }
        else
        {
            const bounds = this.pixiDisplay.getBounds();
            div.style.left = `${bounds.x}px`;
            div.style.top = `${bounds.y}px`;
            div.style.width = `${bounds.width}px`;
            div.style.height = `${bounds.height}px`;
        }
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