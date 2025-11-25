import { Disposable, DisposableGroup } from '@fablevision/utils';
import { Container, Graphics } from 'pixi.js';
import { InteractionManager } from '../dist';
import {HEIGHT, Test, TestUI, WIDTH} from './shared';

let cleanup = new DisposableGroup();
const dragTest: Test = {
    setup(stage: Container)
    {
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        // svg.setAttributeNS(null, "viewBox", '-50 -55 150 125');
        // svg.setAttributeNS(null, "width", '150');
        // svg.setAttributeNS(null, "height", '125');
        const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
        polyline.setAttributeNS(null, 'points', "-50,-50 100,-50, 100,50, 25,75 -50,50");
        polyline.setAttributeNS(null, 'fill', 'none');
        polyline.setAttributeNS(null, 'stroke-width', '12');
        // polyline.setAttributeNS(null, 'y', '6');
        svg.appendChild(polyline);
        // svg.setAttributeNS("http://www.w3.org/2000/xmlns/", "xmlns:xlink", "http://www.w3.org/1999/xlink");;
        const pixiLine = new Graphics();
        const item = new TestUI('SVG Hit Area (line)', 0x9999ff, {htmlOverride: svg as any, pixi: pixiLine} as any);
        pixiLine.lineStyle({width: 12, color: 0x00ff00});
        pixiLine.moveTo(-50, -50).lineTo(100, -50).lineTo(100, 50).lineTo(25, 75).lineTo(-50, 50);
        item.addChild(pixiLine);
        cleanup.add(new Disposable(() => stage.removeChild(item)));
        cleanup.add(item);

        item.interact.onActivate.on(() => window.alert('You activated the thing!'));

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