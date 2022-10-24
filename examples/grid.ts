import { Disposable, DisposableGroup } from '@fablevision/utils';
import { Container } from '@pixi/display';
import { InteractionManager, complex, Keyboard, Interactive, StandaloneGroup } from '../dist';
import {HEIGHT, Test, TestUI, WIDTH} from './shared';

const cleanup = new DisposableGroup();
const gridTest: Test = {
    setup(stage: Container)
    {
        const top = (HEIGHT - (55 * 5)) / 2;
        const left = (WIDTH - (55 * 5)) / 2;
        const grid: (Interactive|null)[][] = [];
        const childrenToRemove: TestUI[] = [];
        for (let x = 0; x < 5; ++x)
        {
            const column: (Interactive|null)[] = [];
            for (let y = 0; y < 5; ++y)
            {
                if (x == 2 && y == 3)
                {
                    column.push(null);
                    continue;
                }
                const box = new TestUI({x: 50, y: 50}, Math.round(Math.random() * 0xffffff), {});
                column.push(box.interact);
                stage.addChild(box);
                box.x = left + 55 * x;
                box.y = top + 55 * y;
                box.interact.onActivate.add(() => console.log('activated at ', x, y));
                childrenToRemove.push(box);
            }
            grid.push(column);
        }

        const k = Keyboard.instance;
        const group = new StandaloneGroup({
            childContext: new complex.GridContext({
                grid,
                tabSelection: 'row',
                arrowSkipsGaps: true,
                arrowLoopsAtEdges: true,
                name: 'test'
            }),
        });

        InteractionManager.instance.activateContext({items: [group], name: 'base'});
        cleanup.add(new Disposable(() => {
            stage.removeChild(...childrenToRemove);
        }), ...childrenToRemove, group);
    },
    teardown()
    {
        cleanup.dispose();
    },
};

export default gridTest;