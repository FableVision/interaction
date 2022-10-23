import { DoubleEvent, Event } from '@fablevision/utils';
import { DragType } from '../Interactive';
import { DragTarget, IDragController } from './interfaces';

/**
 * A drag controller that sits atop a pointer and keyboard drag to simplify hooks within your game.
 */
export class UnifiedDrag<T extends DragTarget> implements IDragController<T>
{
    protected pointer: IDragController<T>;
    protected keyboard: IDragController<T>;
    public dragStarted: DoubleEvent<T, DragType>;
    public dragComplete: Event<T>;

    constructor(pointerDrag: IDragController<T>, keyboardDrag: IDragController<T>)
    {
        this.pointer = pointerDrag;
        this.keyboard = keyboardDrag;
        this.dragStarted = new DoubleEvent();
        this.dragComplete = new Event();
        const end = (target: T) => this.dragComplete.emit(target);
        this.pointer.dragStarted.add((target: T, type?: DragType) => this.dragStarted.emit(target, type || DragType.Held));
        this.keyboard.dragStarted.add((target: T) => this.dragStarted.emit(target, DragType.Keyboard));
        this.pointer.dragComplete.add(end);
        this.keyboard.dragComplete.add(end);
    }

    public cancel(): void
    {
        this.pointer.cancel();
        this.keyboard.cancel();
    }

    public dispose(): void
    {
        this.pointer.dispose();
        this.keyboard.dispose();
        this.dragStarted.dispose();
        this.dragComplete.dispose();
    }
}