/* Main Application Entry Point */
import { resizeCanvas } from './canvas.js';
import { setupMouseEvents, setupKeyboardEvents, setupButtonEvents } from './events.js';
import { setupModalEvents } from './modals.js';
import { setupImageHandlers } from './images.js';
import { setupExportPNG } from './export.js';
import { setupCopyLink } from './copylink.js';
import { setupHelpModal } from './help.js';
import { setupDeepLinks } from './deeplink-setup.js';
import { initializeApp } from './init.js';
import { tick } from './render.js';

// Initialize everything
(function main() {
  resizeCanvas();
  
  // Setup all event handlers
  setupMouseEvents();
  setupKeyboardEvents();
  setupButtonEvents();
  setupModalEvents();
  setupImageHandlers();
  setupExportPNG();
  setupCopyLink();
  setupHelpModal();
  setupDeepLinks();
  
  // Load initial data
  initializeApp().then(() => {
    tick();
  });
})();
