import { useContext } from 'react';
import { BodyContext, BodyContextValue } from '../context/BodyContext';

export function useBody(): BodyContextValue {
  const context = useContext(BodyContext);
  if (!context) {
    throw new Error('useBody deve ser usado dentro de um BodyProvider.');
  }
  return context;
}
