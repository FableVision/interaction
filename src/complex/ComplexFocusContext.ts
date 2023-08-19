import { IDisposable } from '@fablevision/utils';
import { FullFocusContext, GroupEndStrategy } from '../InteractionManager';

export interface ComplexFocusContext extends FullFocusContext
{
    activate(): void;
    deactivate: IDisposable;
    exitRule?: GroupEndStrategy;
}