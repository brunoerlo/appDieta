import { useContext } from 'react';
import { DietContext, DietContextValue } from '../context/DietContext';

export function useDiet(): DietContextValue {
  const context = useContext(DietContext);
  if (!context) {
    throw new Error('useDiet deve ser usado dentro de um DietProvider.');
  }
  return context;
}
