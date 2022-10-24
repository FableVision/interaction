import { Disposable, DisposableGroup } from '@fablevision/utils';
import { Container } from '@pixi/display';
import { DragStrategy, drag, InteractionManager } from '../dist';
import {Test, TestUI} from './shared';

let cleanup = new DisposableGroup();
const dragTest: Test = {
    setup(stage: Container)
    {
        const item = new TestUI('Drag Me', 0x9999ff, {draggable: DragStrategy.DragWithStickyClickTap, minDragDist: 20});
        const bounds: drag.DragBounds = {top: 300, left: 400, right: 800, bottom: 900};
        const controller = new drag.UnifiedDrag(
            new drag.StandardDrag({target: item, interactive: item.interact, bounds}),
            new drag.KeyboardFreeDrag({target: item, interactive: item.interact, moveSpeed: 500, bounds})
        );
        cleanup.add(new Disposable(() => stage.removeChild(item)));
        cleanup.add(controller, item);

        item.x = 500;
        item.y = 400;
        stage.addChild(item);
        InteractionManager.instance.activateContext({items: [item.interact], name: 'base'});
    },
    teardown()
    {
        cleanup.dispose();
    },
};

export default dragTest;