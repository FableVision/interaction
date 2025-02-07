import { Disposable, DisposableGroup, Tween } from '@fablevision/utils';
import { Container } from 'pixi.js';
import { DragStrategy, drag, InteractionManager, DragType } from '../dist';
import {HEIGHT, Test, TestUI, WIDTH} from './shared';

const cleanup = new DisposableGroup();
const dropAreaTest: Test = {
    setup(stage: Container)
    {
        const items = [
            new TestUI({x: 300, y: 300}, 0xffaaaa, {}),
            new TestUI({x: 300, y: 300}, 0xaaffaa, {}),
            new TestUI({x: 300, y: 300}, 0xaaaaff, {}),
        ];
        const left = WIDTH / 2 - (350 * 2.5) / 2;
        for (let i = 0; i < items.length; ++i)
        {
            items[i].x = left + i * 350;
            items[i].y = 300;
            stage.addChild(items[i]);
        }

        const draggable = new TestUI('Drag Me', 0x9999ff, {draggable: DragStrategy.DragWithStickyClickTap, minDragDist: 20});
        const controller = new drag.DropAreaDrag({
            target: draggable,
            interactive: draggable.interact,
            dropAreas: items.map(i => i.interact),
        });
        cleanup.add(controller, draggable, new Disposable(() => stage.removeChild(draggable, ...items)));

        const dragStartPos = {x: 0, y: 0};
        controller.dragStarted.on((item, type) => {
            if (type == DragType.Keyboard)
            {
                draggable.x = WIDTH / 2;
                draggable.y = HEIGHT / 2;
            }
            dragStartPos.x = item.x;
            dragStartPos.y = item.y;
            console.log('drag started!');
        });
        controller.dragComplete.add((item, dropIndex) =>
        {
            console.log('Dropped on area ', dropIndex);
            item.position.copyFrom(items[dropIndex].position);
        });

        controller.dragFailed.add((item) => {
            console.log('dragged to not a drop area');
            Tween.get(item).to(dragStartPos, 0.25, 'quadInOut');
        });

        draggable.x = WIDTH / 2;
        draggable.y = HEIGHT / 2;
        stage.addChild(draggable);
        InteractionManager.instance.activateContext({items: [draggable.interact], name: 'base'});
    },
    teardown()
    {
        cleanup.dispose();
    },
};

export default dropAreaTest;