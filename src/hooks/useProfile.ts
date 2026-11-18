import { useContext } from 'react';
import { ProfileContext, ProfileContextValue } from '../context/ProfileContext';

export function useProfile(): ProfileContextValue {
  const context = useContext(ProfileContext);
  if (!context) {
    throw new Error('useProfile deve ser usado dentro de um ProfileProvider.');
  }
  return context;
}
