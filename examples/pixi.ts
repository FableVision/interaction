import { Application } from '@pixi/app';
import { Renderer, BatchRenderer } from '@pixi/core';
import { TickerPlugin } from '@pixi/ticker';

// Install renderer plugins
Renderer.registerPlugin('batch', BatchRenderer);

// Install application plugins
Application.registerPlugin(TickerPlugin);