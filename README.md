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
    accessiblityDiv: 'interaction',
    renderer: new PixiHandler(myPixiRenderer),
});
// manually enable interaction manager (there will be no input handling otherwise)
interaction.enabled = true;

// elsewhere in code
const buttonInteractive = new Interactive({
    pixi: myPixiButton,
});
buttonInteractive.onActivate.on(() => doTheThing());
InteractionManager.instance.activateContext({items: [buttonInteractive], name: 'MyContext'});
```