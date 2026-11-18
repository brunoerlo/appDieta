import { useContext } from 'react';
import { WorkoutContext, WorkoutContextValue } from '../context/WorkoutContext';

export function useWorkout(): WorkoutContextValue {
  const context = useContext(WorkoutContext);
  if (!context) {
    throw new Error('useWorkout deve ser usado dentro de um WorkoutProvider.');
  }
  return context;
}
