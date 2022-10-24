import './pixi';

import { Application } from '@pixi/app';
import { globalTimer } from '@fablevision/utils';
import { Keyboard, InteractionManager, ControlStrategy } from '../dist';
import { PixiHandler } from '../dist/pixi';
import { HEIGHT, Test, TestUI, WIDTH } from './shared';
import dragTest from './drag';
import shortcutTest from './keyboardShortcut';
import dropTest from './dropArea';
import gridTest from './grid';

const layoutWidth = WIDTH;
const layoutHeight = HEIGHT;
const safeWidth = 1080 / 3 * 4;
const safeHeight = 1080;
const app = new Application({
    width: layoutWidth,
    height: layoutHeight,
    powerPreference: 'high-performance',
    autoStart: true,
    backgroundAlpha: 1,
    backgroundColor: 0xeeeeee,
});
document.getElementById('content')!.appendChild(app.view);
app.ticker.add(() => globalTimer.tick());

const keyboard = new Keyboard();
const accessibilityDiv = document.getElementById('ui') as HTMLDivElement;
const focus = new InteractionManager({ accessibilityDiv, renderer: new PixiHandler(app.renderer), control: ControlStrategy.LockedIn });
focus.enabled = true;

function resize(): void
{
    const width = document.documentElement.clientWidth;
    const height = document.documentElement.clientHeight;
    const scale = Math.min(width / safeWidth, height / safeHeight);
    // -- PIXI -- //
    const renderer = app.renderer;
    renderer.view.style.width = `${layoutWidth * scale}px`;
    renderer.view.style.height = `${layoutHeight * scale}px`;
    // -- INTERACTION -- //
    accessibilityDiv.style.width = `${layoutWidth}px`;
    accessibilityDiv.style.height = `${layoutHeight}px`;
    accessibilityDiv.style.transform = `translate(-50%, -50%) scale(${scale})`;
}
window.addEventListener('resize', resize);
resize();

const nextButton = new TestUI('Next Test', 0xdddddd, {});
nextButton.position.set((layoutWidth - safeWidth) / 2 + 100, 100);
nextButton.interact.onActivate.add(() => next());
app.stage.addChild(nextButton);
focus.setBaseline([], [nextButton.interact]);

// ************************
// now, the actual test begins
const tests = [dragTest, shortcutTest, dropTest, gridTest];
let currentIndex = -1;
let currentTest = null as Test|null;

function next() {
    currentTest?.teardown();
    currentTest = tests[++currentIndex];
    if (!currentTest)
    {
        currentTest = tests[(currentIndex = 0)];
    }
    currentTest.setup(app.stage);
}

next();
