import { IDisposable } from '@fablevision/utils';
import { FullFocusContext } from '../InteractionManager';

export interface ComplexFocusContext extends FullFocusContext
{
    activate(): void;
    deactivate: IDisposable;
}