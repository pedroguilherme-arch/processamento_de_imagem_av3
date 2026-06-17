# Plano de Implementação: Kamehameha Hand Tracking

## Visão Geral

Implementação incremental de uma aplicação web de visão computacional em tempo real que detecta gestos de mãos e renderiza efeitos visuais de Kamehameha. A implementação segue a ordem: setup → tipos compartilhados → módulos core → domínio → UI → orquestração → testes de propriedade → extras opcionais.

## Tarefas

- [x] 1. Setup do projeto e estrutura base
  - [x] 1.1 Inicializar projeto com Vite + TypeScript
    - Criar `package.json` com dependências: mediapipe/hands, three, vitest, fast-check
    - Configurar `tsconfig.json` com strict mode e path aliases
    - Configurar `vite.config.ts` com suporte a TypeScript
    - Criar `index.html` com canvas e container para Three.js
    - _Requisitos: 8.1, 8.4_

  - [x] 1.2 Criar estrutura de diretórios e módulos
    - Criar diretórios: `src/shared/`, `src/core/camera/`, `src/core/gesture/`, `src/core/renderer/`, `src/core/audio/`, `src/core/effects/`, `src/domain/kamehameha/`, `src/domain/tracking/`, `src/ui/`, `src/app/`
    - Criar arquivos `index.ts` de barrel export em cada módulo
    - _Requisitos: 8.1, 8.2, 8.3_

- [x] 2. Tipos compartilhados e constantes (shared/)
  - [x] 2.1 Implementar tipos matemáticos e utilitários
    - Criar `src/shared/math.ts` com interfaces Vec2, Vec3, Color, Rect
    - Criar funções utilitárias: `distance2D`, `normalize2D`, `lerp`, `clamp`, `midpoint`
    - _Requisitos: 3.4, 8.3_

  - [x] 2.2 Implementar constantes da aplicação
    - Criar `src/shared/constants.ts` com GESTURE_CONSTANTS, RENDER_CONSTANTS, CAMERA_CONSTANTS
    - _Requisitos: 3.1, 3.2, 7.4, 7.5, 9.3_

  - [x] 2.3 Implementar tipos de eventos e interfaces compartilhadas
    - Criar `src/shared/types.ts` com GestureState, GestureStateEvent, GestureEventData, AppState
    - Criar `src/shared/events.ts` com EventEmitter tipado genérico
    - _Requisitos: 3.7, 8.3_

- [x] 3. Módulo de câmera (core/camera)
  - [x] 3.1 Implementar CameraModule
    - Criar `src/core/camera/CameraModule.ts` implementando ICameraModule
    - Implementar `initialize()` com getUserMedia e constraints de resolução/fps
    - Implementar tratamento de erros: permission_denied, no_device, stream_error
    - Implementar `start()`, `stop()`, `getVideoElement()`, `isActive()`
    - _Requisitos: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

- [ ] 4. Módulo de rastreamento (core/gesture - HandTracker)
  - [x] 4.1 Implementar HandTracker
    - Criar `src/core/gesture/HandTracker.ts` implementando IHandTracker
    - Integrar MediaPipe Hands com `initialize()` e `processFrame()`
    - Normalizar landmarks para HandData com 21 pontos por mão
    - Configurar detecção de até 2 mãos com `setMaxHands()`
    - _Requisitos: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [ ]* 4.2 Escrever teste de propriedade para estrutura de landmarks
    - **Propriedade 1: Estrutura de dados de landmarks**
    - Verificar que HandTracker produz no máximo 2 HandData, cada um com exatamente 21 landmarks com coordenadas em [0, 1]
    - **Valida: Requisitos 2.2, 2.4**

- [ ] 5. Módulo de gestos (core/gesture - GestureAnalyzer e GestureDetector)
  - [x] 5.1 Implementar GestureAnalyzer
    - Criar `src/core/gesture/GestureAnalyzer.ts` implementando IGestureAnalyzer
    - Implementar `calculateHandsDistance()` com distância euclidiana
    - Implementar `calculateHandCenter()` como média dos landmarks
    - Implementar `calculateSeparationSpeed()` como (d2 - d1) / deltaTime
    - Implementar `calculateFiringDirection()` como vetor normalizado entre centros
    - _Requisitos: 3.4, 3.5_

  - [ ]* 5.2 Escrever teste de propriedade para distância euclidiana
    - **Propriedade 2: Distância euclidiana correta**
    - Para quaisquer dois Vec2, verificar que calculateHandsDistance retorna √((x₂-x₁)² + (y₂-y₁)²)
    - **Valida: Requisito 3.4**

  - [ ]* 5.3 Escrever teste de propriedade para velocidade de separação
    - **Propriedade 3: Velocidade de separação correta**
    - Para quaisquer d1, d2 e deltaTime > 0, verificar que calculateSeparationSpeed retorna (d2 - d1) / deltaTime
    - **Valida: Requisito 3.5**

  - [x] 5.4 Implementar GestureDetector com máquina de estados
    - Criar `src/core/gesture/GestureDetector.ts` implementando IGestureDetector
    - Implementar máquina de estados: idle → charging → firing → idle
    - Implementar transição idle→charging quando distância < CHARGE_DISTANCE_THRESHOLD
    - Implementar transição charging→firing quando distância aumenta > FIRE_DISTANCE_INCREASE em < FIRE_TIME_WINDOW
    - Implementar timeout para idle quando mãos não detectadas > IDLE_TIMEOUT
    - Implementar cálculo de chargeTime como (timestamp_atual - chargeStartTime)
    - Emitir GestureStateEvent via callback em cada transição
    - _Requisitos: 3.1, 3.2, 3.3, 3.6, 3.7_

  - [ ]* 5.5 Escrever teste de propriedade para transição charging
    - **Propriedade 4: Transição para charging**
    - Para quaisquer posições de mãos com distância < limiar e estado idle, verificar transição para charging
    - **Valida: Requisitos 3.1, 9.3**

  - [ ]* 5.6 Escrever teste de propriedade para transição firing
    - **Propriedade 5: Transição para firing**
    - Para estado charging, se distância aumenta > 150px em < 500ms, verificar transição para firing
    - **Valida: Requisito 3.2**

  - [ ]* 5.7 Escrever teste de propriedade para timeout idle
    - **Propriedade 6: Timeout para idle**
    - Para qualquer estado, se nenhuma mão detectada por > 1000ms, verificar transição para idle
    - **Valida: Requisito 3.3**

  - [ ]* 5.8 Escrever teste de propriedade para tempo de carga
    - **Propriedade 7: Tempo de carga acumulado**
    - Para estado charging iniciado em T, verificar que chargeTime = (timestamp_atual - T)
    - **Valida: Requisito 3.6**

- [x] 6. Checkpoint - Verificar módulos core de tracking e gestos
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Módulo de efeitos (core/effects)
  - [x] 7.1 Implementar EffectsCoordinator
    - Criar `src/core/effects/EffectsCoordinator.ts` implementando IEffectsCoordinator
    - Implementar `onGestureStateChange()` para reagir a transições de estado
    - Gerar ParticleEmitConfig com direção "converge" e target no ponto central durante charging
    - Gerar BeamConfig com direção de separação durante firing
    - Gerar GlowConfig posicionado no centro entre as mãos durante charging
    - Gerar flash (100ms) e shake (300ms) na transição para firing
    - Implementar intensidade monotonicamente crescente baseada no chargeTime
    - _Requisitos: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8_

  - [ ]* 7.2 Escrever teste de propriedade para posicionamento de efeitos
    - **Propriedade 8: Posicionamento de efeitos durante charging**
    - Para quaisquer posições de mãos em charging, verificar que efeitos estão no ponto central e partículas convergem para esse ponto
    - **Valida: Requisitos 4.1, 4.2, 4.3, 4.8**

  - [ ]* 7.3 Escrever teste de propriedade para intensidade crescente
    - **Propriedade 9: Intensidade monotonicamente crescente**
    - Para t1 < t2 em charging, verificar que intensidade(t2) >= intensidade(t1)
    - **Valida: Requisito 4.4**

  - [ ]* 7.4 Escrever teste de propriedade para direção do feixe
    - **Propriedade 10: Direção do feixe**
    - Para transição para firing com direção D, verificar que BeamRenderer recebe direção D
    - **Valida: Requisito 4.5**

- [ ] 8. Módulo de renderização (core/renderer)
  - [x] 8.1 Implementar ParticleEngine com Three.js
    - Criar `src/core/renderer/ParticleEngine.ts` implementando IParticleEngine
    - Implementar pool de partículas com limite MAX_PARTICLES (500)
    - Implementar `emit()` com reciclagem de partículas quando pool está cheio
    - Implementar `update()` com deltaTime para animação de partículas
    - _Requisitos: 5.2, 7.5_

  - [ ]* 8.2 Escrever teste de propriedade para limite de partículas
    - **Propriedade 12: Limite máximo de partículas**
    - Para qualquer sequência de emissões, verificar que getActiveCount() nunca excede 500
    - **Valida: Requisito 7.5**

  - [x] 8.3 Implementar BeamRenderer
    - Criar `src/core/renderer/BeamRenderer.ts` implementando IBeamRenderer
    - Implementar `startBeam()`, `updateBeam()`, `stopBeam()` com fade de BEAM_FADE_DURATION
    - Renderizar feixe com gradiente de cor e largura variável
    - _Requisitos: 4.5, 5.1_

  - [x] 8.4 Implementar GlowRenderer
    - Criar `src/core/renderer/GlowRenderer.ts` implementando IGlowRenderer
    - Implementar `renderGlow()` com radial gradient e intensidade variável
    - _Requisitos: 4.2, 5.1_

  - [x] 8.5 Implementar Renderer principal (pipeline)
    - Criar `src/core/renderer/Renderer.ts` implementando IRenderer
    - Coordenar GlowRenderer, ParticleEngine e BeamRenderer em cada frame
    - Implementar frame budget check: descartar frame se processamento > 33ms
    - Usar requestAnimationFrame para loop de renderização
    - _Requisitos: 5.1, 5.3, 5.4, 5.5, 5.6, 7.1, 7.3, 7.4_

  - [ ]* 8.6 Escrever teste de propriedade para frame dropping
    - **Propriedade 13: Frame dropping por orçamento de tempo**
    - Para frame com processamento > 33ms, verificar que o frame é descartado
    - **Valida: Requisito 7.4**

- [x] 9. Módulo de áudio (core/audio)
  - [x] 9.1 Implementar AudioManager
    - Criar `src/core/audio/AudioManager.ts` implementando IAudioManager
    - Implementar `initialize()` com criação de AudioContext
    - Implementar `unlockAudio()` para lidar com autoplay bloqueado
    - Implementar `playChargingSound()`, `playFiringSound()`, `playExplosionSound()`
    - Implementar `stopAll()` e `setVolume()`
    - Sincronizar reprodução com transições de GestureState
    - _Requisitos: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [ ]* 9.2 Escrever teste de propriedade para sincronização áudio-estado
    - **Propriedade 11: Sincronização áudio-estado**
    - Para qualquer transição de GestureState, verificar que o som correspondente é reproduzido
    - **Valida: Requisitos 6.1, 6.2**

- [x] 10. Checkpoint - Verificar módulos core de efeitos, renderização e áudio
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Camada de domínio (domain/)
  - [x] 11.1 Implementar KamehamehaState
    - Criar `src/domain/kamehameha/KamehamehaState.ts`
    - Encapsular lógica de estado do Kamehameha: intensidade, fase, duração
    - Calcular chargeIntensity como valor normalizado 0..1 baseado no tempo de carga
    - _Requisitos: 4.4, 3.6_

  - [x] 11.2 Implementar TrackingData
    - Criar `src/domain/tracking/TrackingData.ts`
    - Encapsular dados de rastreamento: HandTrackingResult, filtros de confiança
    - Filtrar resultados com confiança abaixo de MIN_CONFIDENCE (0.7)
    - _Requisitos: 2.2, 2.3, 2.5_

- [x] 12. Camada de UI (ui/)
  - [x] 12.1 Implementar CanvasManager
    - Criar `src/ui/CanvasManager.ts`
    - Gerenciar canvas principal: resize, clear, composição de layers
    - Renderizar vídeo da webcam como background layer
    - _Requisitos: 1.6, 5.1_

  - [x] 12.2 Implementar OverlayManager
    - Criar `src/ui/OverlayManager.ts`
    - Gerenciar overlays de debug: landmarks, FPS counter
    - Renderizar landmarks como pontos coloridos quando debug habilitado
    - _Requisitos: 9.1, 9.2_

- [x] 13. Orquestração da aplicação (app/)
  - [x] 13.1 Implementar Bootstrap e loop principal
    - Criar `src/app/App.ts` com classe principal de orquestração
    - Implementar `initialize()`: instanciar e conectar todos os módulos
    - Implementar tracking loop separado (~30fps) do render loop (~60fps)
    - Conectar GestureDetector → EffectsCoordinator → Renderer via eventos
    - Conectar GestureDetector → AudioManager via eventos
    - Implementar `start()` e `stop()` para controle do ciclo de vida
    - _Requisitos: 7.1, 7.2, 8.1, 8.2, 8.3_

  - [x] 13.2 Criar ponto de entrada (main.ts)
    - Criar `src/main.ts` que instancia App e chama initialize/start
    - Adicionar tratamento de erros global
    - Adicionar unlock de áudio no primeiro click/touch
    - _Requisitos: 6.5, 1.1_

- [x] 14. Checkpoint final - Verificar integração completa
  - Ensure all tests pass, ask the user if questions arise.

- [x] 15. Funcionalidades extras (opcional)
  - [ ]* 15.1 Implementar modo debug com visualização de landmarks
    - Renderizar os 21 landmarks de cada mão como pontos sobre o vídeo
    - Toggle via tecla de atalho ou flag de configuração
    - _Requisitos: 9.1_

  - [ ]* 15.2 Implementar HUD com contador de FPS
    - Exibir FPS de tracking e rendering no canto superior
    - _Requisitos: 9.2_

  - [ ]* 15.3 Implementar configuração de sensibilidade de gestos
    - Permitir ajuste dos limiares CHARGE_DISTANCE_THRESHOLD e FIRE_DISTANCE_INCREASE via UI
    - _Requisitos: 9.3_

## Notas

- Tarefas marcadas com `*` são opcionais e podem ser ignoradas para um MVP mais rápido
- Cada tarefa referencia requisitos específicos para rastreabilidade
- Checkpoints garantem validação incremental
- Testes de propriedade validam propriedades universais de corretude
- Testes unitários validam exemplos específicos e edge cases
