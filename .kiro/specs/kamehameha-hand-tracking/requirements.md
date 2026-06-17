# Documento de Requisitos

## Introdução

Este documento define os requisitos para uma aplicação web de visão computacional em tempo real que utiliza a webcam do usuário para detectar movimentos das mãos e gerar efeitos visuais de "Kamehameha" inspirados em Dragon Ball. A aplicação utiliza MediaPipe Hands para rastreamento, Canvas/Three.js para renderização de efeitos e Web Audio API para sons, mantendo performance fluida no navegador.

## Glossário

- **Sistema**: A aplicação web de Kamehameha Hand Tracking como um todo
- **CameraModule**: Módulo responsável por capturar e gerenciar o stream de vídeo da webcam
- **HandTracker**: Módulo que utiliza MediaPipe Hands para detectar e rastrear landmarks das mãos
- **GestureDetector**: Módulo que analisa posições das mãos e identifica gestos específicos
- **GestureState**: Máquina de estados que gerencia as transições entre estados de gesto (idle, charging, firing)
- **GestureAnalyzer**: Módulo que calcula métricas de movimento (distância, velocidade, direção)
- **Renderer**: Pipeline principal de renderização que coordena todos os sub-renderers
- **ParticleEngine**: Motor de partículas baseado em Three.js para efeitos visuais
- **BeamRenderer**: Renderizador específico para o feixe do Kamehameha
- **GlowRenderer**: Renderizador de efeitos de brilho (glow)
- **AudioManager**: Módulo que gerencia reprodução de efeitos sonoros via Web Audio API
- **Landmark**: Ponto de referência 3D detectado pelo MediaPipe em cada mão (21 pontos por mão)
- **Charging**: Estado onde as mãos estão próximas, acumulando energia
- **Firing**: Estado onde as mãos se afastam rapidamente, disparando o Kamehameha
- **FPS**: Quadros por segundo (frames per second)

## Requisitos

### Requisito 1: Captura de Vídeo da Webcam

**User Story:** Como usuário, eu quero que a aplicação acesse minha webcam e exiba o vídeo em tempo real, para que eu possa ver minha imagem enquanto interajo com os efeitos.

#### Critérios de Aceitação

1. WHEN o usuário acessa a aplicação, THE CameraModule SHALL solicitar permissão de acesso à câmera via getUserMedia API
2. WHEN a permissão é concedida, THE CameraModule SHALL iniciar a captura de vídeo com resolução mínima de 640x480 pixels
3. WHILE a captura está ativa, THE CameraModule SHALL manter uma taxa de quadros de pelo menos 30 FPS
4. IF a permissão de câmera é negada, THEN THE Sistema SHALL exibir uma mensagem informando que a câmera é necessária para o funcionamento
5. IF o dispositivo não possui câmera disponível, THEN THE Sistema SHALL exibir uma mensagem de erro descritiva
6. WHILE a captura está ativa, THE CameraModule SHALL exibir o stream de vídeo no elemento canvas principal

### Requisito 2: Rastreamento de Mãos

**User Story:** Como usuário, eu quero que a aplicação detecte minhas mãos em tempo real, para que meus gestos possam ser interpretados.

#### Critérios de Aceitação

1. WHILE a captura de vídeo está ativa, THE HandTracker SHALL processar cada frame utilizando MediaPipe Hands
2. WHEN mãos são detectadas no frame, THE HandTracker SHALL extrair as coordenadas (x, y, z) dos 21 landmarks de cada mão
3. WHILE mãos são rastreadas, THE HandTracker SHALL atualizar as coordenadas a cada frame processado
4. THE HandTracker SHALL detectar até 2 mãos simultaneamente
5. IF nenhuma mão é detectada em um frame, THEN THE HandTracker SHALL reportar estado "sem detecção" ao GestureDetector

### Requisito 3: Reconhecimento de Gestos

**User Story:** Como usuário, eu quero que a aplicação reconheça quando junto minhas mãos (carregar energia) e quando as afasto rapidamente (disparar), para que os efeitos visuais correspondam aos meus movimentos.

#### Critérios de Aceitação

1. WHEN a distância entre os centros das duas mãos é menor que 100 pixels, THE GestureDetector SHALL transicionar o GestureState para "charging"
2. WHEN a distância entre as mãos aumenta mais de 150 pixels em menos de 500 milissegundos a partir do estado "charging", THE GestureDetector SHALL transicionar o GestureState para "firing"
3. WHEN nenhuma mão é detectada por mais de 1 segundo, THE GestureDetector SHALL transicionar o GestureState para "idle"
4. THE GestureAnalyzer SHALL calcular a distância euclidiana entre os centros das mãos a cada frame
5. THE GestureAnalyzer SHALL calcular a velocidade de afastamento das mãos em pixels por segundo
6. WHILE o GestureState está em "charging", THE GestureDetector SHALL reportar o tempo acumulado de carga ao Renderer
7. THE GestureDetector SHALL operar de forma desacoplada do Renderer, comunicando-se apenas via eventos ou callbacks

### Requisito 4: Efeitos Visuais

**User Story:** Como usuário, eu quero ver efeitos visuais impressionantes de energia (esfera, brilho, partículas, feixe) que acompanham a posição das minhas mãos, para ter uma experiência imersiva de Kamehameha.

#### Critérios de Aceitação

1. WHILE o GestureState está em "charging", THE Renderer SHALL renderizar uma esfera de energia azul na posição central entre as duas mãos
2. WHILE o GestureState está em "charging", THE GlowRenderer SHALL renderizar um efeito de brilho (glow) ao redor da esfera de energia
3. WHILE o GestureState está em "charging", THE ParticleEngine SHALL emitir partículas convergindo para o centro da esfera
4. WHILE o GestureState está em "charging", THE Renderer SHALL aumentar a intensidade dos efeitos proporcionalmente ao tempo de carga
5. WHEN o GestureState transiciona para "firing", THE BeamRenderer SHALL renderizar um feixe de energia na direção do afastamento das mãos
6. WHEN o GestureState transiciona para "firing", THE Renderer SHALL aplicar um efeito de flash branco com duração de 100 milissegundos
7. WHEN o GestureState transiciona para "firing", THE Renderer SHALL aplicar um efeito de screen shake com duração de 300 milissegundos
8. WHILE efeitos estão ativos, THE Renderer SHALL posicionar os efeitos seguindo a posição das mãos do usuário

### Requisito 5: Pipeline de Renderização

**User Story:** Como desenvolvedor, eu quero um pipeline de renderização desacoplado e modular, para que cada tipo de efeito possa ser mantido e evoluído independentemente.

#### Critérios de Aceitação

1. THE Renderer SHALL utilizar Canvas API como camada base de renderização
2. THE ParticleEngine SHALL utilizar Three.js para renderização de partículas e efeitos 3D
3. THE Renderer SHALL coordenar a execução do GlowRenderer, ParticleEngine e BeamRenderer em cada frame
4. THE Renderer SHALL utilizar requestAnimationFrame para sincronizar a renderização com o refresh rate do navegador
5. THE Renderer SHALL manter a lógica de renderização separada da lógica de rastreamento de mãos
6. WHILE a aplicação está ativa, THE Renderer SHALL processar o loop de renderização independentemente do loop de detecção

### Requisito 6: Efeitos Sonoros

**User Story:** Como usuário, eu quero ouvir efeitos sonoros correspondentes ao carregamento e disparo do Kamehameha, para uma experiência mais imersiva.

#### Critérios de Aceitação

1. WHEN o GestureState transiciona para "charging", THE AudioManager SHALL reproduzir o som de carregamento de energia
2. WHEN o GestureState transiciona para "firing", THE AudioManager SHALL reproduzir o som de disparo
3. WHEN o efeito de feixe atinge intensidade máxima, THE AudioManager SHALL reproduzir o som de explosão
4. THE AudioManager SHALL utilizar Web Audio API ou elemento HTML Audio para reprodução de sons
5. IF o navegador bloqueia autoplay de áudio, THEN THE AudioManager SHALL aguardar interação do usuário antes de habilitar sons

### Requisito 7: Performance

**User Story:** Como usuário, eu quero que a aplicação funcione de forma fluida sem travamentos, para que a experiência seja responsiva e agradável.

#### Critérios de Aceitação

1. WHILE a aplicação está ativa, THE Sistema SHALL manter taxa de renderização de pelo menos 30 FPS
2. THE Sistema SHALL executar o loop de rastreamento de mãos separado do loop de renderização
3. THE Sistema SHALL utilizar requestAnimationFrame para todas as operações de renderização
4. THE Renderer SHALL descartar frames de efeitos visuais quando o tempo de processamento exceder 33 milissegundos por frame
5. THE ParticleEngine SHALL limitar o número máximo de partículas ativas a 500 simultaneamente

### Requisito 8: Arquitetura Modular (SDD)

**User Story:** Como desenvolvedor, eu quero que o código seja organizado em módulos desacoplados seguindo princípios de SDD, para facilitar manutenção e evolução.

#### Critérios de Aceitação

1. THE Sistema SHALL organizar o código fonte na estrutura: core/ (camera, gesture, renderer, audio, effects), domain/ (kamehameha, tracking), shared/ (math, utils, constants), ui/ (canvas, overlays), app/
2. THE Sistema SHALL separar a lógica de domínio (regras de gesto, estados) da infraestrutura (câmera, renderização)
3. THE Sistema SHALL implementar comunicação entre módulos via interfaces definidas, sem dependências diretas entre módulos de domínio e infraestrutura
4. THE Sistema SHALL utilizar TypeScript para tipagem estática em todos os módulos


### Requisito 9: Funcionalidades Extras (Opcional)

**User Story:** Como usuário avançado, eu quero funcionalidades adicionais de debug e configuração, para personalizar e monitorar a experiência.

#### Critérios de Aceitação

1. WHERE o modo debug está habilitado, THE Sistema SHALL renderizar os landmarks das mãos como pontos visíveis sobre o vídeo
2. WHERE o HUD está habilitado, THE Sistema SHALL exibir o contador de FPS atual no canto superior da tela
3. WHERE configuração de sensibilidade está disponível, THE GestureDetector SHALL permitir ajuste dos limiares de distância para detecção de gestos
4. WHERE múltiplos poderes estão habilitados, THE Sistema SHALL suportar gestos adicionais além do Kamehameha
