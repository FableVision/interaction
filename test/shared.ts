import { Keyboard, InteractionManager, InteractiveOpts } from '../dist';
import { PixiInteractive } from '../dist/pixi';
import { Text } from '@pixi/text';
import { Sprite } from '@pixi/sprite';
import { Texture } from '@pixi/core';
import { Container } from '@pixi/display';

export class TestUI extends Container
{
    public interact: PixiInteractive;

    constructor(text: string, color: number, opts: InteractiveOpts)
    {
        super();

        const textObj = new Text(text, { align: 'center', wordWrap: true, wordWrapWidth: 200 });
        textObj.anchor.set(0.5);
        const sprite = new Sprite(Texture.WHITE);
        sprite.width = textObj.width + 10;
        sprite.height = textObj.height + 10;
        sprite.anchor.set(0.5);
        sprite.tint = color;
        this.addChild(sprite);
        this.addChild(textObj);

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