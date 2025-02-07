import { Disposable, DisposableGroup } from '@fablevision/utils';
import { Container } from 'pixi.js';
import { DragStrategy, drag, InteractionManager } from '../dist';
import {HEIGHT, Test, TestUI, WIDTH} from './shared';

let cleanup = new DisposableGroup();
const dragTest: Test = {
    setup(stage: Container)
    {
        const item = new TestUI('Drag Me', 0x9999ff, {draggable: DragStrategy.DragWithStickyClickTap, minDragDist: 20});
        const bounds: drag.DragBounds = {
            top: (HEIGHT - 500) / 2,
            left: (WIDTH - 500) / 2,
            right: (WIDTH - 500) / 2 + 500,
            bottom: (HEIGHT - 500) / 2 + 500
        };
        const controller = new drag.UnifiedDrag(
            new drag.StandardDrag({target: item, interactive: item.interact, bounds}),
            new drag.KeyboardFreeDrag({target: item, interactive: item.interact, moveSpeed: 500, bounds})
        );
        cleanup.add(new Disposable(() => stage.removeChild(item)));
        cleanup.add(controller, item);

        item.x = WIDTH / 2;
        item.y = HEIGHT / 2;
        stage.addChild(item);
        InteractionManager.instance.activateContext({items: [item.interact], name: 'base'});
    },
    teardown()
    {
        cleanup.dispose();
    },
};

export default dragTest;