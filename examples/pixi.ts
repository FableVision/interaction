import { Application } from '@pixi/app';
import { Renderer, BatchRenderer, extensions } from '@pixi/core';
import { TickerPlugin } from '@pixi/ticker';

// Install renderer plugins
extensions.add(BatchRenderer);

// Install application plugins
extensions.add(TickerPlugin);