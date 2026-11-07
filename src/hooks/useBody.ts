import { useContext } from 'react';
import { BodyContext, BodyContextValue } from '../context/BodyContext';

export function useBody(): BodyContextValue {
  const context = useContext(BodyContext);
  if (!context) {
    throw new Error('useBody must be used within a BodyProvider');
  }
  return context;
}
