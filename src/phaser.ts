import type { GameObjects } from 'phaser';
import { Interactive, InteractiveOpts, IPoint, } from './Interactive';
import { IRendererPlugin } from './InteractionManager';

export class PhaserInteractive extends Interactive
{
    /** The sprite object this represents */
    private objectDisplay: Phaser.GameObjects.Sprite;
    private transformMatrix: Phaser.GameObjects.Components.TransformMatrix;
    private game: Phaser.Game;

    constructor(opts: InteractiveOpts & { phaser: Phaser.GameObjects.Sprite, game: Phaser.Game })
    {
        super(opts);

        this.transformMatrix = new Phaser.GameObjects.Components.TransformMatrix();
        this.objectDisplay = opts.phaser;
        this.game = opts.game;
    }

    public get visible(): boolean { return this._visible; }
    public set visible(visible: boolean)
    {
        this.objectDisplay.visible = visible;
        super.visible = visible;
    }

    public updatePosition(): void
    {
        const div = this.htmlElement;
        const hitArea = (this.objectDisplay as any).hitArea;
        if (hitArea)
        {
            this.objectDisplay.getWorldTransformMatrix(this.transformMatrix);
            div.style.left = `${this.transformMatrix.tx + (hitArea.x * this.transformMatrix.a)}px`;
            div.style.top = `${this.transformMatrix.ty + (hitArea.y * this.transformMatrix.d)}px`;

            div.style.width = `${hitArea.width * this.transformMatrix.a}px`;
            div.style.height = `${hitArea.height * this.transformMatrix.d}px`;
        }
        else
        {
            const bounds = this.objectDisplay.getBounds();
            div.style.left = `${bounds.x}px`;
            div.style.top = `${bounds.y}px`;
            div.style.width = `${bounds.width}px`;
            div.style.height = `${bounds.height}px`;
        }
    }
}

export class PhaserHandler implements IRendererPlugin
{
    private phaser: typeof Phaser.Renderer;
    private game: Phaser.Game;

    constructor(phaser: typeof Phaser.Renderer, game: Phaser.Game)
    {
        this.phaser = phaser;
        this.game = game;
    }

    mapClientPosToPoint(x: number, y: number): IPoint
    {
        const view = this.game.canvas;
        const rect = view.getBoundingClientRect();
        const resolutionMultiplier = 1.0 / this.game.scale.getMaxZoom();

        return {
            x: ((x - rect.left) * (view.width / rect.width)) * resolutionMultiplier,
            y: ((y - rect.top) * (view.height / rect.height)) * resolutionMultiplier,
        };
    }

    forceTransformUpdate(): void
    {
        // TODO
        // legitimately not sure of way to do what this is asking in phaser, just gonna hope this is never really needed for now
        // this.game.
        // if (this.phaser._lastObjectRendered) {
        //     // ensure all transforms are updated so that positioning is correct for bounds
        //     const displayObject = this.phaser._lastObjectRendered;
        //     const cacheParent = displayObject.enableTempParent();
        //     displayObject.updateTransform();
        //     displayObject.disableTempParent(cacheParent);
        // }
    }
}