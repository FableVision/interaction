import { Keyboard, InteractionManager, InteractiveOpts, IPoint } from '../dist';
import { PixiInteractive } from '../dist/pixi';
import { Text } from '@pixi/text';
import { Sprite } from '@pixi/sprite';
import { Texture } from '@pixi/core';
import { Container } from '@pixi/display';

export class TestUI extends Container
{
    public interact: PixiInteractive;

    constructor(text: string | IPoint, color: number, opts: InteractiveOpts)
    {
        super();

        let width = 0, height = 0;
        if (typeof text == 'string')
        {
            const textObj = new Text(text, { align: 'center', wordWrap: true, wordWrapWidth: 200 });
            textObj.anchor.set(0.5);
            this.addChild(textObj);
            width = textObj.width + 10;
            height = textObj.height + 10;
        }
        else
        {
            width = text.x;
            height = text.y;
        }
        const sprite = new Sprite(Texture.WHITE);
        sprite.width = width;
        sprite.height = height;
        sprite.anchor.set(0.5);
        sprite.tint = color;
        this.addChildAt(sprite, 0);

        this.interact = new PixiInteractive(Object.assign({ pixi: this }, opts));
    }

    public dispose()
    {
        this.interact.dispose();
        this.destroy({children: true});
    }
}

export interface Test
{
    setup(stage: Container): void;
    teardown(): void;
}