import { Disposable, DisposableGroup } from '@fablevision/utils';
import { Container, Sprite, Texture } from 'pixi.js';
import { InteractionManager, complex, Keyboard, Interactive, StandaloneGroup, DragStrategy } from '../dist';
import { HEIGHT, Test, TestUI, WIDTH } from './shared';

let cleanup = new DisposableGroup();
const mouseMoveTest: Test = {
    setup(stage: Container)
    {
        const item = new TestUI({x: 500, y: 500}, 0x999999, { draggable: DragStrategy.LocalMoveNoDrag, pointerOnly: true, css: {outlineStyle: 'none'}});
        cleanup.add(new Disposable(() => stage.removeChild(item)));
        cleanup.add(item);

        item.x = WIDTH / 2;
        item.y = HEIGHT / 2;
        stage.addChild(item);

        const follow = new Sprite(Texture.WHITE);
        follow.width = 30;
        follow.height = 30;
        follow.tint = 0xff3333;
        follow.anchor.set(0.5);
        cleanup.add(new Disposable(() => {stage.removeChild(follow); follow.destroy();}));
        stage.addChild(follow);

        item.interact.mouseMove.add(point => {
            follow.position.set(point.x, point.y)
        });

        InteractionManager.instance.activateContext({items: [item.interact], name: 'base'});
    },
    teardown()
    {
        cleanup.dispose();
    },
};

export default mouseMoveTest;