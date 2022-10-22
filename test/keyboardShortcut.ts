import { Disposable, DisposableGroup } from '@fablevision/utils';
import { Container } from '@pixi/display';
import { InteractionManager, complex, Keyboard } from '../dist';
import {Test, TestUI} from './shared';

const cleanup = new DisposableGroup();
const shortcutTest: Test = {
    setup(stage: Container)
    {
        const items = [
            new TestUI('Item 1 (Left)', 0xffffff, {}),
            new TestUI('Item 2 (Up)', 0xffffff, {}),
            new TestUI('Item 3 (Right)', 0xffffff, {}),
        ];
        for (let i = 0; i < items.length; ++i)
        {
            items[i].x = 400 + i * 200;
            items[i].y = 300;
            stage.addChild(items[i]);
            items[i].interact.onActivate.add(() => console.log('Activated item ' + i));
        }

        const k = Keyboard.instance;
        const group = new TestUI({x: 600, y: 100}, 0xffffff, {
            childContext: new complex.KeyboardShortcutContext(items.map(item => item.interact), [k.LEFT, k.UP, k.RIGHT], 'test', true),
        });

        group.x = 600;
        group.y = 300;
        stage.addChildAt(group, 0);
        InteractionManager.instance.activateContext({items: [group.interact], name: 'base'});
        cleanup.add(new Disposable(() => {
            stage.removeChild(...items, group);
        }), ...items, group);
    },
    teardown()
    {
        cleanup.dispose();
    },
};

export default shortcutTest;