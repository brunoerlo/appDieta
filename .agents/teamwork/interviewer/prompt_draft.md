Construir o MVP completo de um aplicativo mobile em React Native e Expo (TypeScript, Expo Router) voltado para iPhone 16 (iOS) para acompanhamento diário de nutrição, progressão de treinos de força e evolução corporal, utilizando SQLite local (`expo-sqlite`) com Repository Pattern e interface esportiva Dark Mode.

Working directory: /home/bruno/Documentos/app
Integrity mode: development

Material de referência:
- Especificação técnica: /home/bruno/.gemini/antigravity/brain/428ce75e-7e77-4760-a870-4b96f2db804f/app_specification.md
- Regras de desenvolvimento Expo: /home/bruno/Documentos/app/AGENTS.md

## Requirements

### R1. Camada de Dados e Persistência Local em SQLite
Implementar o banco de dados relacional local com `expo-sqlite` estruturado através do Repository Pattern (`DietRepository`, `WorkoutRepository`, `BodyRepository`, `AuthRepository`) com tipagem TypeScript completa. O banco deve conter as tabelas relacionais (`users`, `foods`, `diet_logs`, `water_logs`, `workout_routines`, `routine_exercises`, `workout_sessions`, `set_logs`, `body_logs`) e realizar o seed inicial dos alimentos brasileiros da Tabela TACO/IBGE e rotinas de treino padrão, isolando a persistência para futura migração ao Supabase.

### R2. Módulo de Nutrição e Hidratação
Implementar o diário de refeições categorizado (Café da Manhã, Almoço, Lanche, Jantar, Ceia) calculando calorias totais e macronutrientes (proteínas, carboidratos, gorduras) em relação às metas diárias do usuário. Incluir busca local indexada na base TACO/IBGE, consulta de produtos industrializados via Open Food Facts API (com suporte a leitor de código de barras), criação manual de alimentos personalizados e rastreador de consumo diário de água com atalhos de incremento rápido (+250ml, +500ml) e barra de progresso.

### R3. Módulo de Treinos e Progressão de Carga
Implementar o cadastro e personalização de fichas de treino (divisões como ABC, Push/Pull/Legs) e o fluxo de execução de treino em tempo real (Live Workout). Durante a execução, exibir para cada exercício a carga e repetições realizadas na última sessão, registrar as séries concluídas (série x repetições x peso em kg), acionar cronômetro de descanso automático com feedback tátil (`expo-haptics`) ao concluir cada série, e disponibilizar histórico e gráficos de progressão de carga e volume.

### R4. Módulo de Peso, Composição Corporal e Interface
Implementar o registro diário de pesagem matinal com cálculo automático de média móvel de 7 dias e gráfico de tendência; registro de percentual de gordura corporal, massa magra/gorda e circunferências corporais (cintura, tórax, braço, coxa); registro fotográfico de evolução com visualização comparativa (Antes vs. Depois); e design esportivo moderno em Dark Mode como padrão (alto contraste OLED) com alternador para Light Mode nas configurações de perfil.

### R5. Qualidade de Código e Compatibilidade com Plataforma
Garantir total aderência às convenções do Expo Router em `src/app/`, compatibilidade com iOS (iPhone 16 via Expo Go), tratamento de erros e integridade relacional no SQLite, e ausência de erros de tipagem TypeScript e lint.

## Acceptance Criteria

### Integridade do Banco de Dados e Repositórios
- [ ] As migrações do banco SQLite (`expo-sqlite`) executam com sucesso na inicialização, criando todas as tabelas especificadas.
- [ ] Os dados da tabela TACO/IBGE são carregados no banco local durante o primeiro uso e consultas por nome de alimento retornam resultados em menos de 100ms.
- [ ] Os repositórios (`DietRepository`, `WorkoutRepository`, `BodyRepository`, `AuthRepository`) implementam interfaces desacopladas da UI e passam em testes unitários automatizados cobrindo operações de CRUD.

### Funcionalidades do Módulo de Dieta e Água
- [ ] O usuário consegue registrar alimentos consumidos em cada refeição, e a soma de calorias e macros atualiza instantaneamente na tela do dia selecionado.
- [ ] A busca de alimentos pesquisa na base TACO local e na API do Open Food Facts, permitindo selecionar e adicionar o alimento à refeição.
- [ ] O botão de incremento de água soma o volume correto e persiste no histórico diário.

### Funcionalidades do Módulo de Treino
- [ ] O usuário consegue iniciar uma sessão de treino baseada em uma rotina cadastrada.
- [ ] Ao abrir um exercício na sessão de treino, as cargas e repetições da última sessão realizada são exibidas como referência na linha de cada série.
- [ ] Ao marcar uma série como concluída, o timer de descanso é iniciado automaticamente com acionamento do feedback tátil (`expo-haptics`).
- [ ] Ao finalizar o treino, a sessão e suas séries são salvas no banco SQLite e ficam visíveis no histórico de treinos.

### Funcionalidades do Módulo de Peso e Composição
- [ ] O registro de pesagem calcula e exibe corretamente a média móvel dos últimos 7 dias.
- [ ] O formulário de composição corporal registra medidas e calcula estimativas de massa magra e gorda a partir do % de gordura informado.

### Interface e Validação Técnica
- [ ] O aplicativo inicializa com tema Dark Mode esportivo e permite alternar para Light Mode através das configurações.
- [ ] A navegação por abas e rotas utiliza a estrutura do Expo Router em `src/app/` sem rotas quebradas.
- [ ] A verificação de tipos (`npx tsc --noEmit`) executa sem nenhum erro.
- [ ] A verificação de lint (`npx expo lint`) executa sem erros ou warnings bloqueantes.
- [ ] O comando de testes automatizados (`npm test`) passa com 100% de sucesso para os repositórios e lógica de negócios.
