import './pixi';

import { Application } from '@pixi/app';
import { globalTimer } from '@fablevision/utils';
import { Keyboard, InteractionManager, ControlStrategy } from '../dist';
import { PixiHandler } from '../dist/pixi';
import { Test } from './shared';
import dragTest from './drag';
import shortcutTest from './keyboardShortcut';

const layoutWidth = 2160;
const layoutHeight = 1080;
const safeWidth = 1080 / 3 * 4;
const safeHeight = 1080;
const app = new Application({
    width: layoutWidth,
    height: layoutHeight,
    powerPreference: 'high-performance',
    autoStart: true,
    transparent: true,
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

// ************************
// now, the actual test begins
const tests = [dragTest, shortcutTest];
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

keyboard.addGlobal({keys: 'shift + backspace', up: next});
next();
