# Kamehameha Hand Tracking ✋⚡

Aplicação web de visão computacional em tempo real que detecta gestos das mãos via webcam e renderiza efeitos visuais de Kamehameha inspirados em Dragon Ball.

## Demo

1. Junte as duas mãos na frente da câmera → energia começa a carregar
2. Feche os dedos cerrando o punho, para disparar 

## Tech Stack

- **TypeScript** + **Vite**
- **MediaPipe Hands** — rastreamento de mãos (21 landmarks por mão)
- **Three.js** — motor de partículas e efeitos 3D
- **Canvas 2D** — composição de vídeo e overlays
- **Web Audio API** — efeitos sonoros sincronizados
- **Vitest** + **fast-check** — testes unitários e property-based testing

## Requisitos

- Node.js 18+
- Navegador com suporte a WebRTC (Chrome, Edge, Firefox)
- Webcam

## Instalação

```bash
npm install
```

## Executando

```bash
npm run dev
```

Acesse `http://localhost:5173` e permita o acesso à câmera.

## Scripts

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de produção |
| `npm run preview` | Serve o build de produção |
| `npm run test` | Roda os testes |
| `npm run test:watch` | Testes em modo watch |

## Arquitetura

```
src/
├── app/          # Bootstrap e orquestração
├── core/
│   ├── audio/    # Efeitos sonoros (Web Audio API)
│   ├── camera/   # Captura de webcam
│   ├── effects/  # Coordenação de efeitos visuais
│   ├── gesture/  # Detecção de gestos e rastreamento
│   └── renderer/ # Pipeline de renderização (partículas, beam, glow)
├── domain/       # Lógica de domínio (estados, dados de tracking)
├── shared/       # Tipos, constantes, utilitários
└── ui/           # Canvas e overlays
```

## Como funciona

1. **CameraModule** captura frames da webcam
2. **HandTracker** processa frames com MediaPipe Hands (~30fps)
3. **GestureDetector** interpreta landmarks e gerencia estados (idle → charging → firing)
4. **EffectsCoordinator** traduz transições de estado em comandos visuais
# Kamehameha Hand Tracking ✋⚡

Aplicação web de visão computacional em tempo real que detecta gestos das mãos via webcam e renderiza efeitos visuais de Kamehameha inspirados em Dragon Ball.

## Demo

1. Junte as duas mãos na frente da câmera → energia começa a carregar
2. Afaste as mãos rapidamente → dispara o Kamehameha!

## Tech Stack

- **TypeScript** + **Vite**
- **MediaPipe Hands** — rastreamento de mãos (21 landmarks por mão)
- **Three.js** — motor de partículas e efeitos 3D
- **Canvas 2D** — composição de vídeo e overlays
- **Web Audio API** — efeitos sonoros sincronizados
- **Vitest** + **fast-check** — testes unitários e property-based testing

## Requisitos

- Node.js 18+
- Navegador com suporte a WebRTC (Chrome, Edge, Firefox)
- Webcam

## Instalação

```bash
npm install
```

## Executando

```bash
npm run dev
```

Acesse `http://localhost:5173` e permita o acesso à câmera.

## Scripts

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de produção |
| `npm run preview` | Serve o build de produção |
| `npm run test` | Roda os testes |
| `npm run test:watch` | Testes em modo watch |

## Arquitetura

```
src/
├── app/          # Bootstrap e orquestração
├── core/
│   ├── audio/    # Efeitos sonoros (Web Audio API)
│   ├── camera/   # Captura de webcam
│   ├── effects/  # Coordenação de efeitos visuais
│   ├── gesture/  # Detecção de gestos e rastreamento
│   └── renderer/ # Pipeline de renderização (partículas, beam, glow)
├── domain/       # Lógica de domínio (estados, dados de tracking)
├── shared/       # Tipos, constantes, utilitários
└── ui/           # Canvas e overlays
```

## Como funciona

1. **CameraModule** captura frames da webcam
2. **HandTracker** processa frames com MediaPipe Hands (~30fps)
3. **GestureDetector** interpreta landmarks e gerencia estados (idle → charging → firing)
4. **EffectsCoordinator** traduz transições de estado em comandos visuais
5. **Renderer** renderiza partículas, glow e beam via Three.js + Canvas (~60fps)
6. **AudioManager** sincroniza sons com as transições

## Gestos

| Gesto | Ação |
|-------|------|
| Mãos juntas (< 100px) | Inicia carregamento de energia |
| Afastar rápido (> 150px em < 500ms) | Dispara o Kamehameha |
| Sem mãos detectadas (> 1s) | Volta ao estado idle |

## Licença

MIT
