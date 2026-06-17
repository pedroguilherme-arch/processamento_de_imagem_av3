import { App } from './app';

/**
 * Kamehameha Hand Tracking - Entry Point
 *
 * Initializes the App, handles global errors, and unlocks audio
 * on the first user interaction (click/touch).
 */

async function main(): Promise<void> {
  const app = new App();

  try {
    await app.initialize();
    await app.start();
  } catch (error) {
    console.error('[Kamehameha] Failed to initialize:', error);
    showError(error);
    return;
  }

  // Unlock audio on first user interaction (browser autoplay policy)
  const unlockHandler = async () => {
    try {
      await app.unlockAudio();
    } catch {
      // Audio unlock failed silently — non-critical
    }
    document.removeEventListener('click', unlockHandler);
    document.removeEventListener('touchstart', unlockHandler);
  };

  document.addEventListener('click', unlockHandler, { once: true });
  document.addEventListener('touchstart', unlockHandler, { once: true });
}

/**
 * Display a user-facing error message when initialization fails.
 */
function showError(error: unknown): void {
  const appEl = document.getElementById('app');
  if (!appEl) return;

  const message =
    error instanceof DOMException && error.name === 'NotAllowedError'
      ? 'Permissão de câmera necessária para o funcionamento da aplicação.'
      : 'Erro ao inicializar a aplicação. Verifique se sua câmera está disponível.';

  const overlay = document.createElement('div');
  overlay.style.cssText =
    'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.85);color:#fff;font:1.2rem sans-serif;text-align:center;padding:2rem;';
  overlay.textContent = message;
  appEl.appendChild(overlay);
}

// Global unhandled error logging
window.addEventListener('unhandledrejection', (event) => {
  console.error('[Kamehameha] Unhandled rejection:', event.reason);
});

main();
