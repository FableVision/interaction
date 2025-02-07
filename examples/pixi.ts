import { TickerPlugin, BatchRenderer, extensions } from 'pixi.js';

// Install renderer plugins
extensions.add(BatchRenderer);

// Install application plugins
extensions.add(TickerPlugin);