# IronTrack 🏋️‍♂️🥗

Aplicativo mobile **offline-first** desenvolvido em **React Native + Expo (TypeScript e Expo Router)** para acompanhamento diário de nutrição, hidratação, progressão de treinos de força e evolução corporal.

Projetado com interface esportiva de alto contraste em **OLED Dark Mode (`#0A0A0C`)** por padrão (com suporte a **Light Mode**) e persistência local ultrarrápida via **SQLite (`expo-sqlite`)** estruturada com **Repository Pattern**.

---

## ✨ Funcionalidades Principais

### 🥗 Nutrição e Hidratação
- **Diário de Refeições Categorizado**: Registro em 5 refeições (*Café da Manhã, Almoço, Lanche, Jantar e Ceia*) com atualização instantânea de calorias e macronutrientes (proteínas, carboidratos, gorduras e fibras).
- **Base Brasileira TACO/IBGE Local**: Busca indexada sub-100ms com normalização de acentos (encontra alimentos digitando com ou sem acentuação, ex.: `pao frances` ou `pão francês`).
- **Open Food Facts & Código de Barras**: Consulta de produtos industrializados via API do Open Food Facts v2 e leitor de código de barras EAN/UPC integrado.
- **Alimentos Personalizados**: Criação manual de alimentos e ajuste dinâmico de porções em gramas.
- **Rastreador de Água**: Barra de progresso diária com atalhos rápidos (`+250ml`, `+500ml`), opção de desfazer último registro e proteção contra saldo negativo.

### 🏋️‍♂️ Treinos e Progressão de Carga
- **Gestão de Rotinas**: Catálogo com fichas padrão (*ABC, Push/Pull/Legs*) e criação/edição personalizada de exercícios, séries-alvo e tempo de descanso.
- **Live Workout (Execução em Tempo Real)**:
  - Exibe automaticamente a **carga (kg) e repetições realizadas na última sessão** como referência em cada série.
  - Checklist de séries concluídas com cálculo em tempo real do volume total movimentado.
  - **Timer de Descanso Automático** com feedback tátil (`expo-haptics`) ao concluir cada série.
- **Histórico e Análises de Força**: Histórico detalhado de sessões e gráficos de progressão de carga máxima, volume e estimativa de **1RM** (*fórmulas de Brzycki e Epley*).

### 📈 Evolução Corporal, Medidas e Fotos
- **Pesagem Matinal & Média Móvel de 7 Dias**: Registro diário de peso com cálculo automático da média móvel de 7 dias e gráfico comparativo (*peso diário vs. tendência semanal*).
- **Composição Corporal e Circunferências**: Cálculo automático de **Massa Magra** e **Massa Gorda** a partir do `% de Gordura Corporal`, além de histórico de medidas em centímetros (*cintura, tórax, braços e coxas*).
- **Fotos de Evolução (Antes vs. Depois)**: Galeria local categorizada por pose (*frente, costas, perfil*) com visualizador comparativo lado a lado entre datas.

### ⚙️ Perfil e Personalização
- Configuração de metas diárias de calorias, macronutrientes e ingestão de água.
- Alternância instantânea entre **OLED Dark Mode** e **Light Mode** persistida localmente.

---

## 🏗️ Arquitetura e Tecnologias

- **Framework**: React Native `0.88` + Expo SDK `58`
- **Linguagem**: TypeScript `6.0` (strict mode)
- **Navegação**: Expo Router (`src/app/`) com navegação por abas e modais tipados
- **Banco de Dados**: SQLite local (`expo-sqlite`) em modo `WAL` com chaves estrangeiras ativas e 15 índices B-tree
- **Padrão de Dados**: Repository Pattern desacoplado (`IDietRepository`, `IWorkoutRepository`, `IBodyRepository`, `IAuthRepository`), facilitando futura sincronização em nuvem (ex.: Supabase)
- **Testes**: Jest + `jest-expo` (testes unitários, integração, estresse e E2E)

```text
├── src/
│   ├── app/                  # Rotas e telas do Expo Router
│   │   ├── (tabs)/           # 4 abas principais: Dieta, Treino, Evolução e Perfil
│   │   ├── nutrition/        # Busca de alimentos, scanner de código de barras e alimento customizado
│   │   ├── workout/          # Execução Live Workout, editor de fichas e histórico/1RM
│   │   └── body/             # Registro de medidas e comparador de fotos Antes vs. Depois
│   ├── components/           # Componentes visuais reutilizáveis (UI, Nutrition, Workout, Body)
│   ├── constants/            # Tokens de tema OLED Dark Mode e Light Mode
│   ├── context/              # Contextos de estado da aplicação (Diet, Workout, Body, Profile, Theme)
│   ├── database/             # Conexão SQLite, migrations, seeds (TACO + rotinas) e repositórios
│   ├── hooks/                # Hooks customizados (useDiet, useWorkout, useBody, useProfile, useTheme)
│   ├── services/             # Integração Open Food Facts API e armazenamento local de fotos
│   ├── types/                # Contratos e tipagens de domínio
│   └── utils/                # Fórmulas matemáticas (Atwater, Brzycki/Epley 1RM, Média Móvel 7d)
└── tests/                    # Suíte automatizada (Unitários, E2E Tiers 1-4 e Stress/Adversarial)
```

---

## 🚀 Como Executar

### Pré-requisitos
- **Node.js** (v20+ recomendado)
- Aplicativo **Expo Go** instalado no iOS / Android (ou simulador configurado)

### Instalação e Execução

```bash
# 1. Instalar dependências
npm install

# 2. Iniciar o servidor de desenvolvimento do Expo
npx expo start
```

Escaneie o QR Code exibido no terminal com a câmera do iPhone (para abrir no **Expo Go**) ou pressione `i` para abrir no simulador iOS / `a` para Android.

---

## 🧪 Qualidade e Testes

O projeto conta com uma suíte completa de **671 testes automatizados** distribuídos em **32 suítes** (cobrindo repositórios SQLite, cálculos matemáticos, fluxos E2E e testes de estresse/concorrência):

```bash
# Executar todos os testes automatizados
npm test

# Verificar tipagem TypeScript
npx tsc --noEmit

# Executar verificação de lint
npx expo lint
```

---

## 📄 Licença

Distribuído sob a licença MIT. Veja o arquivo [LICENSE](./LICENSE) para mais informações.
