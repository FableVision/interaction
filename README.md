# Fablevision Interaction
Accessible interactivity designed for Canvas-based (Pixi, Phaser, EaselJS, etc) games.

## Context stacks
Both Keyboard and InteractionManager use stacks of interaction contexts, so that interactivity can be quickly superseded and then restored
for things like popups or items that are grouped in the UI for keyboard controls. You'll be expected to use `activateContext()` with a context name
in order to enable interactivity, and then `popContext()` to remove it when you are done. Listeners all use the [Disposable](https://gitlab.com/fablevision/public-utils/utils/-/blob/main/src/Disposable.ts) pattern, so return an object that has a `dispose()` method for cleanup.

## Keyboard usage
The Keyboard class is built upon [KeyboardJS](https://github.com/RobertWHurst/KeyboardJS/), so uses key names/combinations as documented there.
```javascript
// initialize singleton
const keyboard = new Keyboard();

// elsewhere in code
const removeListener = Keyboard.instance.add('ctrl + s', () => save());
```

## Importing
The main classes can be imported with `import { InteractionManager, Keyboard } from '@fablevision/interaction';`, but each plugin handler should be imported like so: `import { PhaserHandler } from '@fablevision/interaction/dist/phaser';`

Current plugin support: Pixi, Phaser 3

## Interaction usage
```javascript
// keyboard must be created first
const keyboard = new Keyboard();
// initialize singleton
// note that this should be done AFTER the constructor for something like Phaser, as when setting up the Handler this.game isn't generated until after construction
const interaction = new InteractionManager({
    // This can be the id of a div, or the HTMLDivElement directly, and will be filled with interactive divs.
    // *You* are responsible for ensuring that the div is the same size/scale/location as your canvas.
    // Note that you may need to keep it from scrolling, if elements are sometimes partially offscreen (but still focusable). You may also wish to use `user-select: none;` on it to prevent the text/image selection tinting.
    accessiblityDiv: 'interaction',
    // a handler specific to your canvas rendering style
    renderer: new PixiHandler(myPixiRenderer),
});
// manually enable interaction manager (there will be no input handling otherwise)
interaction.enabled = true;

// elsewhere in code
// use the interactive class specific to your canvas rendering style
const buttonInteractive = new PixiInteractive({
    pixi: myPixiButton,
});
buttonInteractive.onActivate.on(() => doTheThing());
InteractionManager.instance.activateContext({items: [buttonInteractive], name: 'MyContext'});
```

If the desired implementation is to drag a static object that is duplicated for a sticky click, make the static object draggable and have the `dragStart` event immediately call `transferDrag` on the target (duplicated) object.

For example (from Marsico Bajillions, Hidden Pictures Explore):
```js
  let clickEv = () => {
    let newInteractive = this.addShapeEdit(newShape.children[0], true);
    console.log('transferring drag from', shapeInteractive, 'to', newInteractive);
    shapeInteractive.transferDrag(newInteractive);
  }
  let shapeInteractive = new HTMLInteractive({
    html: shape._renderer.elem,
    container: this.htmlContent,
    draggable: 2,
  });
  shapeInteractive.dragStart.add(clickEv);
```