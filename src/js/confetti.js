/**
 * Sistema de confete para RFCP Tracker
 * Cria animações de celebração quando o usuário completa tarefas
 * @fileoverview Sistema de partículas para animações de celebração
 * @author Sthefany Ricardo  
 * @version 2.0.0
 */

'use strict';

/**
 * Configurações do sistema de confete
 */
const CONFETTI_CONFIG = {
  COLORS: [
    '#f94144', // Vermelho
    '#f3722c', // Laranja vermelho
    '#f8961e', // Laranja
    '#f9c74f', // Amarelo
    '#90be6d', // Verde claro
    '#43aa8b', // Verde azulado
    '#577590'  // Azul acinzentado
  ],
  PARTICLE_COUNT: 50,
  Z_INDEX: 9999,
  GRAVITY: 0.1,
  PARTICLE_SIZE: {
    MIN: 5,
    MAX: 15
  },
  SPEED: {
    X_RANGE: 6,
    Y_MIN: -6,
    Y_MAX: -3
  },
  ROTATION_SPEED: 10
};

/**
 * Representa uma partícula individual de confete
 */
class ConfettiParticle {
  /**
   * Cria uma nova partícula
   * @param {number} x - Posição X inicial
   * @param {number} y - Posição Y inicial
   * @param {Array<string>} colors - Array de cores disponíveis
   */
  constructor(x, y, colors) {
    this.x = x;
    this.y = y;
    this.size = Math.random() * (CONFETTI_CONFIG.PARTICLE_SIZE.MAX - CONFETTI_CONFIG.PARTICLE_SIZE.MIN) + CONFETTI_CONFIG.PARTICLE_SIZE.MIN;
    this.color = colors[Math.floor(Math.random() * colors.length)];
    this.speedX = Math.random() * CONFETTI_CONFIG.SPEED.X_RANGE - (CONFETTI_CONFIG.SPEED.X_RANGE / 2);
    this.speedY = Math.random() * (CONFETTI_CONFIG.SPEED.Y_MAX - CONFETTI_CONFIG.SPEED.Y_MIN) + CONFETTI_CONFIG.SPEED.Y_MIN;
    this.gravity = CONFETTI_CONFIG.GRAVITY;
    this.rotation = Math.random() * 360;
    this.rotationSpeed = Math.random() * CONFETTI_CONFIG.ROTATION_SPEED - (CONFETTI_CONFIG.ROTATION_SPEED / 2);
    this.alpha = 1.0;
    this.fadeSpeed = 0.02;
  }

  /**
   * Atualiza a posição e propriedades da partícula
   */
  update() {
    // Atualizar posição
    this.x += this.speedX;
    this.y += this.speedY;
    this.speedY += this.gravity;
    
    // Atualizar rotação
    this.rotation += this.rotationSpeed;
    
    // Fade out gradual
    this.alpha = Math.max(0, this.alpha - this.fadeSpeed);
  }

  /**
   * Renderiza a partícula no canvas
   * @param {CanvasRenderingContext2D} ctx - Contexto do canvas
   */
  render(ctx) {
    ctx.save();
    
    // Aplicar transparência
    ctx.globalAlpha = this.alpha;
    
    // Posicionar e rotacionar
    ctx.translate(this.x, this.y);
    ctx.rotate((this.rotation * Math.PI) / 180);
    
    // Desenhar partícula
    ctx.fillStyle = this.color;
    ctx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size);
    
    ctx.restore();
  }

  /**
   * Verifica se a partícula deve ser removida
   * @param {number} canvasWidth - Largura do canvas
   * @param {number} canvasHeight - Altura do canvas
   * @returns {boolean}
   */
  shouldRemove(canvasWidth, canvasHeight) {
    return (
      this.y > canvasHeight + 50 || 
      this.x < -50 || 
      this.x > canvasWidth + 50 ||
      this.alpha <= 0
    );
  }
}

/**
 * Sistema principal de confete
 * Gerencia criação, animação e renderização de partículas
 */
class ConfettiSystem {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.particles = [];
    this.animationFrame = null;
    this.isInitialized = false;
    
    this.animate = this.animate.bind(this);
    this.handleResize = this.handleResize.bind(this);
  }

  /**
   * Inicializa o sistema de confete
   */
  init() {
    if (this.isInitialized) {
      return;
    }

    this.createCanvas();
    this.setupCanvas();
    this.addEventListeners();
    
    this.isInitialized = true;
    console.log('✅ Sistema de confete inicializado');
  }

  /**
   * Cria o elemento canvas
   */
  createCanvas() {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
    
    if (!this.ctx) {
      throw new Error('Não foi possível obter contexto 2D do canvas');
    }
  }

  /**
   * Configura as propriedades do canvas
   */
  setupCanvas() {
    // Estilos CSS
    Object.assign(this.canvas.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      pointerEvents: 'none',
      zIndex: CONFETTI_CONFIG.Z_INDEX.toString()
    });
    
    // Adicionar ao DOM
    document.body.appendChild(this.canvas);
    
    // Configurar tamanho
    this.resizeCanvas();
  }

  /**
   * Adiciona event listeners necessários
   */
  addEventListeners() {
    window.addEventListener('resize', this.handleResize);
  }

  /**
   * Remove event listeners
   */
  removeEventListeners() {
    window.removeEventListener('resize', this.handleResize);
  }

  /**
   * Manipula redimensionamento da janela
   */
  handleResize() {
    this.resizeCanvas();
  }

  /**
   * Ajusta o tamanho do canvas
   */
  resizeCanvas() {
    if (!this.canvas) return;
    
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  /**
   * Cria uma explosão de confete
   * @param {number} x - Posição X da explosão
   * @param {number} y - Posição Y da explosão
   * @param {number} count - Número de partículas (opcional)
   */
  burst(x, y, count = CONFETTI_CONFIG.PARTICLE_COUNT) {
    if (!this.isInitialized) {
      this.init();
    }

    // Criar partículas
    for (let i = 0; i < count; i++) {
      this.particles.push(new ConfettiParticle(x, y, CONFETTI_CONFIG.COLORS));
    }
    
    // Iniciar animação se não estiver rodando
    if (!this.animationFrame) {
      this.animate();
    }

    console.log(`🎉 Explosão de confete criada em (${x}, ${y}) com ${count} partículas`);
  }

  /**
   * Cria múltiplas explosões aleatórias
   * @param {number} explosionCount - Número de explosões
   */
  multipleRandomBursts(explosionCount = 3) {
    if (!this.isInitialized) {
      this.init();
    }

    for (let i = 0; i < explosionCount; i++) {
      setTimeout(() => {
        const x = Math.random() * window.innerWidth;
        const y = Math.random() * (window.innerHeight * 0.3) + (window.innerHeight * 0.1);
        this.burst(x, y);
      }, i * 200);
    }
  }

  /**
   * Cria confete a partir de um elemento específico
   * @param {Element} element - Elemento de referência
   * @param {number} count - Número de partículas (opcional)
   */
  burstFromElement(element, count = CONFETTI_CONFIG.PARTICLE_COUNT) {
    if (!element) {
      console.warn('⚠️ Elemento não encontrado para explosão de confete');
      return;
    }

    const rect = element.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    
    this.burst(x, y, count);
  }

  /**
   * Loop principal de animação
   */
  animate() {
    // Limpar canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Atualizar e renderizar partículas
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const particle = this.particles[i];
      
      particle.update();
      particle.render(this.ctx);
      
      // Remover partículas que saíram da tela
      if (particle.shouldRemove(this.canvas.width, this.canvas.height)) {
        this.particles.splice(i, 1);
      }
    }
    
    // Continuar animação se há partículas
    if (this.particles.length > 0) {
      this.animationFrame = requestAnimationFrame(this.animate);
    } else {
      this.animationFrame = null;
    }
  }

  /**
   * Para a animação e limpa partículas
   */
  stop() {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
    
    this.particles = [];
    
    if (this.ctx) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  /**
   * Limpa o sistema e remove do DOM
   */
  destroy() {
    this.stop();
    this.removeEventListeners();
    
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
    
    this.canvas = null;
    this.ctx = null;
    this.isInitialized = false;
    
    console.log('✅ Sistema de confete destruído');
  }

  /**
   * Retorna informações sobre o estado do sistema
   * @returns {Object}
   */
  getStatus() {
    return {
      initialized: this.isInitialized,
      particleCount: this.particles.length,
      animating: !!this.animationFrame,
      canvasSize: this.canvas ? {
        width: this.canvas.width,
        height: this.canvas.height
      } : null
    };
  }
}

/**
 * Utilitários para uso conveniente do confete
 */
class ConfettiUtils {
  /**
   * Cria confete para celebrar conclusão de tarefa
   * @param {Element} taskElement - Elemento da tarefa concluída
   */
  static celebrateTaskCompletion(taskElement) {
    if (window.confettiSystem) {
      window.confettiSystem.burstFromElement(taskElement, 30);
      
      // Explosão adicional após um delay
      setTimeout(() => {
        window.confettiSystem.multipleRandomBursts(2);
      }, 500);
    }
  }

  /**
   * Cria confete para celebrar milestone
   */
  static celebrateMilestone() {
    if (window.confettiSystem) {
      window.confettiSystem.multipleRandomBursts(5);
    }
  }

  /**
   * Cria confete para celebrar conclusão total
   */
  static celebrateCompletion() {
    if (window.confettiSystem) {
      // Múltiplas explosões em sequência
      for (let i = 0; i < 10; i++) {
        setTimeout(() => {
          window.confettiSystem.multipleRandomBursts(3);
        }, i * 300);
      }
    }
  }
}

// Inicializar sistema global
if (typeof window !== 'undefined') {
  window.ConfettiSystem = ConfettiSystem;
  window.ConfettiUtils = ConfettiUtils;
  
  // Criar instância global
  window.confettiSystem = new ConfettiSystem();
  
  // Manter compatibilidade com código existente
  window.confetti = {
    burst: (x, y) => window.confettiSystem.burst(x, y)
  };
}

// Exportar para ambientes Node.js se necessário
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ConfettiSystem, ConfettiParticle, ConfettiUtils };
}