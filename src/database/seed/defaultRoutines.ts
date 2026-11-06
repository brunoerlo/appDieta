export interface SeedRoutineExercise {
  name: string;
  muscleGroup: string;
  targetSets: number;
  defaultRestSeconds: number;
  sortOrder: number;
}

export interface SeedWorkoutRoutine {
  id: string;
  name: string;
  description: string;
  sortOrder: number;
  exercises: SeedRoutineExercise[];
}

export const DEFAULT_ROUTINES_SEED: SeedWorkoutRoutine[] = [
  // --- DIVISÃO ABC ---
  {
    id: 'routine-abc-a',
    name: 'Treino A - Peito, Tríceps e Ombros',
    description: 'Divisão ABC clássica: peitoral, deltoides anteriores/laterais e tríceps',
    sortOrder: 1,
    exercises: [
      { name: 'Supino Reto com Barra', muscleGroup: 'Peito', targetSets: 4, defaultRestSeconds: 90, sortOrder: 1 },
      { name: 'Supino Inclinado com Halteres', muscleGroup: 'Peito', targetSets: 3, defaultRestSeconds: 75, sortOrder: 2 },
      { name: 'Crossover na Polia Média', muscleGroup: 'Peito', targetSets: 3, defaultRestSeconds: 60, sortOrder: 3 },
      { name: 'Desenvolvimento com Halteres', muscleGroup: 'Ombros', targetSets: 3, defaultRestSeconds: 75, sortOrder: 4 },
      { name: 'Elevação Lateral na Polia', muscleGroup: 'Ombros', targetSets: 4, defaultRestSeconds: 60, sortOrder: 5 },
      { name: 'Tríceps Corda na Polia', muscleGroup: 'Tríceps', targetSets: 3, defaultRestSeconds: 60, sortOrder: 6 },
      { name: 'Tríceps Testa com Barra W', muscleGroup: 'Tríceps', targetSets: 3, defaultRestSeconds: 60, sortOrder: 7 },
    ],
  },
  {
    id: 'routine-abc-b',
    name: 'Treino B - Costas, Bíceps e Trapézio',
    description: 'Divisão ABC clássica: dorsais, deltoides posteriores, trapézio e bíceps',
    sortOrder: 2,
    exercises: [
      { name: 'Puxada Alta Aberta', muscleGroup: 'Costas', targetSets: 4, defaultRestSeconds: 90, sortOrder: 1 },
      { name: 'Remada Curvada com Barra', muscleGroup: 'Costas', targetSets: 4, defaultRestSeconds: 90, sortOrder: 2 },
      { name: 'Remada Baixa no Triângulo', muscleGroup: 'Costas', targetSets: 3, defaultRestSeconds: 75, sortOrder: 3 },
      { name: 'Crucifixo Invertido com Halteres', muscleGroup: 'Deltoides', targetSets: 3, defaultRestSeconds: 60, sortOrder: 4 },
      { name: 'Encolhimento com Halteres', muscleGroup: 'Trapézio', targetSets: 3, defaultRestSeconds: 60, sortOrder: 5 },
      { name: 'Rosca Direta com Barra W', muscleGroup: 'Bíceps', targetSets: 3, defaultRestSeconds: 60, sortOrder: 6 },
      { name: 'Rosca Martelo com Halteres', muscleGroup: 'Bíceps', targetSets: 3, defaultRestSeconds: 60, sortOrder: 7 },
    ],
  },
  {
    id: 'routine-abc-c',
    name: 'Treino C - Pernas Completo e Abdômen',
    description: 'Divisão ABC clássica: quadríceps, posteriores, glúteos, panturrilhas e abdômen',
    sortOrder: 3,
    exercises: [
      { name: 'Agachamento Livre com Barra', muscleGroup: 'Pernas', targetSets: 4, defaultRestSeconds: 120, sortOrder: 1 },
      { name: 'Leg Press 45°', muscleGroup: 'Pernas', targetSets: 4, defaultRestSeconds: 90, sortOrder: 2 },
      { name: 'Cadeira Extensora', muscleGroup: 'Pernas', targetSets: 3, defaultRestSeconds: 60, sortOrder: 3 },
      { name: 'Mesa Flexora', muscleGroup: 'Pernas', targetSets: 4, defaultRestSeconds: 75, sortOrder: 4 },
      { name: 'Stiff com Halteres', muscleGroup: 'Pernas', targetSets: 3, defaultRestSeconds: 75, sortOrder: 5 },
      { name: 'Panturrilha em Pé na Máquina', muscleGroup: 'Panturrilha', targetSets: 4, defaultRestSeconds: 45, sortOrder: 6 },
      { name: 'Abdominal Supra na Polia', muscleGroup: 'Abdômen', targetSets: 3, defaultRestSeconds: 45, sortOrder: 7 },
    ],
  },
  // --- DIVISÃO PUSH / PULL / LEGS (PPL) ---
  {
    id: 'routine-ppl-push',
    name: 'Push (Empurrar)',
    description: 'Divisão PPL: peito, deltoide anterior/lateral e tríceps',
    sortOrder: 4,
    exercises: [
      { name: 'Supino Reto com Halteres', muscleGroup: 'Peito', targetSets: 4, defaultRestSeconds: 90, sortOrder: 1 },
      { name: 'Supino Inclinado com Barra', muscleGroup: 'Peito', targetSets: 3, defaultRestSeconds: 90, sortOrder: 2 },
      { name: 'Paralelas / Dips', muscleGroup: 'Peito/Tríceps', targetSets: 3, defaultRestSeconds: 75, sortOrder: 3 },
      { name: 'Desenvolvimento Militar em Pé', muscleGroup: 'Ombros', targetSets: 4, defaultRestSeconds: 90, sortOrder: 4 },
      { name: 'Elevação Lateral com Halteres', muscleGroup: 'Ombros', targetSets: 4, defaultRestSeconds: 60, sortOrder: 5 },
      { name: 'Tríceps Francês com Halter', muscleGroup: 'Tríceps', targetSets: 3, defaultRestSeconds: 60, sortOrder: 6 },
    ],
  },
  {
    id: 'routine-ppl-pull',
    name: 'Pull (Puxar)',
    description: 'Divisão PPL: costas, deltoide posterior, trapézio e bíceps',
    sortOrder: 5,
    exercises: [
      { name: 'Barra Fixa (Pronada ou Supinada)', muscleGroup: 'Costas', targetSets: 4, defaultRestSeconds: 90, sortOrder: 1 },
      { name: 'Levantamento Terra Convencional', muscleGroup: 'Costas/Pernas', targetSets: 3, defaultRestSeconds: 120, sortOrder: 2 },
      { name: 'Remada Unilateral (Serrote)', muscleGroup: 'Costas', targetSets: 3, defaultRestSeconds: 75, sortOrder: 3 },
      { name: 'Face Pull na Polia com Corda', muscleGroup: 'Deltoides', targetSets: 4, defaultRestSeconds: 60, sortOrder: 4 },
      { name: 'Rosca Scott com Barra W', muscleGroup: 'Bíceps', targetSets: 3, defaultRestSeconds: 60, sortOrder: 5 },
      { name: 'Rosca Inclinada com Halteres', muscleGroup: 'Bíceps', targetSets: 3, defaultRestSeconds: 60, sortOrder: 6 },
    ],
  },
  {
    id: 'routine-ppl-legs',
    name: 'Legs (Pernas & Core)',
    description: 'Divisão PPL: membros inferiores completos e estabilização de core',
    sortOrder: 6,
    exercises: [
      { name: 'Agachamento Búlgaro com Halteres', muscleGroup: 'Pernas', targetSets: 3, defaultRestSeconds: 90, sortOrder: 1 },
      { name: 'Cadeira Flexora', muscleGroup: 'Pernas', targetSets: 4, defaultRestSeconds: 75, sortOrder: 2 },
      { name: 'Cadeira Extensora', muscleGroup: 'Pernas', targetSets: 4, defaultRestSeconds: 60, sortOrder: 3 },
      { name: 'Elevação Pélvica com Barra', muscleGroup: 'Glúteos', targetSets: 4, defaultRestSeconds: 90, sortOrder: 4 },
      { name: 'Panturrilha no Leg Press', muscleGroup: 'Panturrilha', targetSets: 4, defaultRestSeconds: 45, sortOrder: 5 },
      { name: 'Prancha Abdominal Isométrica', muscleGroup: 'Core', targetSets: 3, defaultRestSeconds: 45, sortOrder: 6 },
    ],
  },
];
