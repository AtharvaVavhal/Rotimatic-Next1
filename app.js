/**
 * ROTIMATIC NEXT — Interactive Application Logic
 * Production Asset Integration:
 *  1. Asset 1: Real Drag-to-Rotate 360° Turnaround Viewer (7 ordered frames: Front -> Right -> Back -> Left -> Front)
 *  2. Asset 2: Dramatic Black Spotlight Showcase with Vignette Edge Blend
 *  3. Asset 3: "In Real Indian Kitchens" Lifestyle Showcase
 *  4. Real HTML5 Video Player with Scroll-into-view Autoplay & Floating Unmute Pill
 *  5. Interactive Variant Switcher (Polar White ₹14,999 vs Onyx Black ₹24,999)
 *  6. Complete Dummy Checkout / Buy Now Modal (Client Demo Mock)
 *     // TODO: integrate real payment gateway once client provides merchant account (Razorpay/PayU/Stripe)
 */

// Global State
const appState = {
  currentVariant: 'black',
  heroMode: 'spotlight', // 'spotlight' | '360'
  quantity: 1,
  current360Frame: 1,
  customer: {
    name: 'Rahul Sharma',
    phone: '9876543210',
    address: 'Flat 402, Lotus Grand, Link Road',
    city: 'Mumbai',
    pin: '400050'
  },
  selectedPaymentMethod: 'upi',
  variants: {
    black: {
      key: 'black',
      name: 'Onyx Black Edition',
      price: 24999,
      originalPrice: 32999,
      savings: 8000,
      image: 'assets/rotimatic-black-dramatic.jpg',
      badge: '5 Year Guarantee • Flagship Titanium',
      summary: 'Onyx Black Edition (1 Unit)'
    },
    white: {
      key: 'white',
      name: 'Polar White Edition',
      price: 14999,
      originalPrice: 19999,
      savings: 5000,
      image: 'assets/rotimatic-360-01.jpg',
      badge: '5 Year Guarantee Included',
      summary: 'Polar White Edition (1 Unit)'
    }
  },
  // Asset 1 Turnaround Ordered Frames (1 to 7)
  turnaroundFrames: [
    { frame: 1, src: 'assets/rotimatic-360-01.jpg', label: 'Front (0°)' },
    { frame: 2, src: 'assets/rotimatic-360-02.jpg', label: 'Front-Right 45°' },
    { frame: 3, src: 'assets/rotimatic-360-03.jpg', label: 'Right Side (90°)' },
    { frame: 4, src: 'assets/rotimatic-360-04.jpg', label: 'Back-Right (135°)' },
    { frame: 5, src: 'assets/rotimatic-360-05.jpg', label: 'Back (180°)' },
    { frame: 6, src: 'assets/rotimatic-360-06.jpg', label: 'Back-Left (225°)' },
    { frame: 7, src: 'assets/rotimatic-360-07.jpg', label: 'Left Side (270°)' }
  ]
};

// DOM Content Loaded Initializer
document.addEventListener('DOMContentLoaded', () => {
  preload360Images();
  init3DHeroTilt();
  init360Viewer();
  initVideoPlayer();
  initNavigationScroll();
  initMobileMenu();
  updateCheckoutSummary();
});

/* ==========================================================================
   1. PRELOAD 360° TURNAROUND IMAGES
   ========================================================================== */
const preloadedImages = [];
function preload360Images() {
  appState.turnaroundFrames.forEach(item => {
    const img = new Image();
    img.src = item.src;
    preloadedImages.push(img);
  });
}

/* ==========================================================================
   2. HERO MODE SWITCHER (SPOTLIGHT VS 360°)
   ========================================================================== */
function setHeroViewMode(mode) {
  appState.heroMode = mode;

  const btnSpotlight = document.getElementById('btnModeSpotlight');
  const btn360 = document.getElementById('btnMode360');
  const viewSpotlight = document.getElementById('viewSpotlight');
  const view360 = document.getElementById('view360');

  if (mode === 'spotlight') {
    btnSpotlight.classList.add('active');
    btn360.classList.remove('active');
    viewSpotlight.classList.add('active');
    view360.classList.remove('active');
    showToast('✨ Switched to Studio Spotlight View', 'orange');
  } else {
    btn360.classList.add('active');
    btnSpotlight.classList.remove('active');
    view360.classList.add('active');
    viewSpotlight.classList.remove('active');
    showToast('🔄 Drag horizontally to spin 360°', 'orange');
  }
}

/* ==========================================================================
   3. REAL DRAG-TO-ROTATE 360° TURNAROUND VIEWER (Asset 1)
   ========================================================================== */
function init360Viewer() {
  const container = document.getElementById('viewer360Container');
  const turnaroundImg = document.getElementById('turnaroundImg');
  if (!container || !turnaroundImg) return;

  let isDragging = false;
  let startX = 0;
  const pixelsPerFrame = 28; // drag distance required to change 1 frame
  let accumulatedDelta = 0;

  // Mouse drag handlers
  container.addEventListener('mousedown', (e) => {
    isDragging = true;
    startX = e.clientX;
    accumulatedDelta = 0;
    container.style.cursor = 'grabbing';
  });

  window.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      container.style.cursor = 'grab';
    }
  });

  container.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const deltaX = e.clientX - startX;
    startX = e.clientX;
    handleRotationStep(deltaX);
  });

  // Touch drag handlers (Mobile)
  container.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
      isDragging = true;
      startX = e.touches[0].clientX;
      accumulatedDelta = 0;
    }
  }, { passive: true });

  container.addEventListener('touchend', () => {
    isDragging = false;
  });

  container.addEventListener('touchmove', (e) => {
    if (!isDragging || e.touches.length !== 1) return;
    const currentX = e.touches[0].clientX;
    const deltaX = currentX - startX;
    startX = currentX;
    handleRotationStep(deltaX);
  }, { passive: true });

  // Handle dot clicks
  document.querySelectorAll('.turnaround-dots-row .t-dot').forEach(dot => {
    dot.addEventListener('click', (e) => {
      const targetFrame = parseInt(e.currentTarget.getAttribute('data-frame'), 10);
      if (!isNaN(targetFrame)) {
        set360Frame(targetFrame);
      }
    });
  });
}

function handleRotationStep(deltaX) {
  // Dragging right rotates forward, dragging left rotates backward
  const threshold = 22;
  if (Math.abs(deltaX) < 1) return;

  let nextFrame = appState.current360Frame;
  if (deltaX > threshold / 2) {
    nextFrame = appState.current360Frame + 1;
    if (nextFrame > 7) nextFrame = 1;
    set360Frame(nextFrame);
  } else if (deltaX < -threshold / 2) {
    nextFrame = appState.current360Frame - 1;
    if (nextFrame < 1) nextFrame = 7;
    set360Frame(nextFrame);
  }
}

function set360Frame(frameIndex) {
  appState.current360Frame = frameIndex;
  const frameData = appState.turnaroundFrames[frameIndex - 1];
  if (!frameData) return;

  const turnaroundImg = document.getElementById('turnaroundImg');
  const angleLabel = document.getElementById('angleNameText');
  const dots = document.querySelectorAll('.turnaround-dots-row .t-dot');

  if (turnaroundImg) {
    turnaroundImg.src = frameData.src;
  }
  if (angleLabel) {
    angleLabel.textContent = frameData.label;
  }

  // Update dots
  dots.forEach(dot => {
    const f = parseInt(dot.getAttribute('data-frame'), 10);
    dot.classList.toggle('active', f === frameIndex);
  });
}

/* ==========================================================================
   4. 3D HERO PRODUCT TILT & PARALLAX EFFECT
   ========================================================================== */
function init3DHeroTilt() {
  const stage = document.getElementById('hero3DStage');
  const card = document.getElementById('product3DCard');
  if (!stage || !card) return;

  let isHovered = false;

  stage.addEventListener('mouseenter', () => {
    isHovered = true;
  });

  stage.addEventListener('mouseleave', () => {
    isHovered = false;
    card.style.transform = 'perspective(1200px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)';
  });

  stage.addEventListener('mousemove', (e) => {
    if (!isHovered || appState.heroMode === '360') return; // Tilt in spotlight mode

    const rect = stage.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotateX = -((y - centerY) / centerY) * 12;
    const rotateY = ((x - centerX) / centerX) * 14;

    card.style.transform = `perspective(1200px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) scale3d(1.02, 1.02, 1.02)`;
  });

  // Window scroll subtle parallax
  window.addEventListener('scroll', () => {
    const scrollY = window.scrollY;
    if (scrollY < 800) {
      const floatY = Math.sin(scrollY * 0.005) * 5;
      if (!isHovered) {
        card.style.transform = `perspective(1200px) translateY(${floatY.toFixed(1)}px)`;
      }
    }
  }, { passive: true });
}

/* ==========================================================================
   5. REAL VIDEO PLAYER (SCROLL-INTO-VIEW AUTOPLAY & UNMUTE)
   ========================================================================== */
function initVideoPlayer() {
  const video = document.getElementById('howItWorksVideo');
  if (!video) return;

  // IntersectionObserver to auto-play muted on scroll into view
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          video.play().catch(() => {
            // Autoplay policy prevented playback, controls remain interactive
          });
        } else {
          video.pause();
        }
      });
    }, { threshold: 0.35 });

    observer.observe(video);
  }
}

function toggleVideoSound() {
  const video = document.getElementById('howItWorksVideo');
  const icon = document.getElementById('unmuteIcon');
  const text = document.getElementById('unmuteText');
  if (!video) return;

  if (video.muted) {
    video.muted = false;
    video.play().catch(() => {});
    if (icon) icon.textContent = '🔇';
    if (text) text.textContent = 'Mute Audio';
    showToast('🔊 Audio Unmuted');
  } else {
    video.muted = true;
    if (icon) icon.textContent = '🔊';
    if (text) text.textContent = 'Click for Sound';
    showToast('🔇 Audio Muted');
  }
}

/* ==========================================================================
   6. VARIANT SWITCHER
   ========================================================================== */
function selectVariant(variantKey, triggerToast = true) {
  if (!appState.variants[variantKey]) return;
  appState.currentVariant = variantKey;
  const variant = appState.variants[variantKey];

  // Update Hero elements
  const heroImg = document.getElementById('heroProductImage');
  const heroDot = document.getElementById('heroVariantDot');
  const heroTitle = document.getElementById('heroVariantTitle');
  const heroPrice = document.getElementById('heroPriceTag');

  if (heroImg) {
    heroImg.style.opacity = '0.3';
    setTimeout(() => {
      heroImg.src = variant.image;
      heroImg.alt = `Rotimatic NEXT ${variant.name}`;
      heroImg.style.opacity = '1';
    }, 150);
  }

  if (heroDot) {
    heroDot.className = `pill-indicator ${variantKey === 'black' ? 'black' : ''}`;
  }
  if (heroTitle) heroTitle.textContent = variant.name;
  if (heroPrice) heroPrice.textContent = `₹${variant.price.toLocaleString('en-IN')}`;

  // Update Variant cards styling
  const cardWhite = document.getElementById('variantCardWhite');
  const cardBlack = document.getElementById('variantCardBlack');

  if (cardWhite && cardBlack) {
    if (variantKey === 'black') {
      cardBlack.classList.add('active');
      cardBlack.setAttribute('aria-pressed', 'true');
      cardBlack.querySelector('.select-text').textContent = 'Selected (Active)';
      cardBlack.querySelector('.check-icon').textContent = '✓';

      cardWhite.classList.remove('active');
      cardWhite.setAttribute('aria-pressed', 'false');
      cardWhite.querySelector('.select-text').textContent = 'Choose Polar White';
      cardWhite.querySelector('.check-icon').textContent = '→';
    } else {
      cardWhite.classList.add('active');
      cardWhite.setAttribute('aria-pressed', 'true');
      cardWhite.querySelector('.select-text').textContent = 'Selected (Active)';
      cardWhite.querySelector('.check-icon').textContent = '✓';

      cardBlack.classList.remove('active');
      cardBlack.setAttribute('aria-pressed', 'false');
      cardBlack.querySelector('.select-text').textContent = 'Choose Onyx Black';
      cardBlack.querySelector('.check-icon').textContent = '→';
    }
  }

  // Update Modal radio controls
  const radioWhite = document.querySelector('input[name="checkoutVariant"][value="white"]');
  const radioBlack = document.querySelector('input[name="checkoutVariant"][value="black"]');
  if (variantKey === 'white' && radioWhite) radioWhite.checked = true;
  if (variantKey === 'black' && radioBlack) radioBlack.checked = true;

  updateCheckoutSummary();

  if (triggerToast) {
    showToast(`Switched to ${variant.name} (₹${variant.price.toLocaleString('en-IN')})`, 'orange');
  }
}

function selectAndCheckout(variantKey) {
  selectVariant(variantKey, false);
  openCheckoutModal(variantKey);
}

/* ==========================================================================
   7. CHECKOUT / BUY NOW MODAL FLOW
   ========================================================================== */
function openCheckoutModal(variantKey = null) {
  if (variantKey && appState.variants[variantKey]) {
    selectVariant(variantKey, false);
  }

  const modal = document.getElementById('checkoutModal');
  if (!modal) return;

  goToCheckoutStep(1);
  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeCheckoutModal() {
  const modal = document.getElementById('checkoutModal');
  if (!modal) return;
  modal.classList.remove('active');
  document.body.style.overflow = '';
}

// Close on backdrop click
document.addEventListener('click', (e) => {
  const modal = document.getElementById('checkoutModal');
  if (modal && e.target === modal) {
    closeCheckoutModal();
  }
});

// Close on Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeCheckoutModal();
  }
});

function setCheckoutVariant(variantKey) {
  selectVariant(variantKey, false);
}

function updateQuantity(delta) {
  const newQty = appState.quantity + delta;
  if (newQty < 1 || newQty > 10) return;
  appState.quantity = newQty;

  const display = document.getElementById('modalQtyDisplay');
  if (display) display.textContent = newQty;

  const cartCounter = document.getElementById('cartCountBadge');
  if (cartCounter) cartCounter.textContent = newQty;

  updateCheckoutSummary();
}

function updateCheckoutSummary() {
  const variant = appState.variants[appState.currentVariant];
  const qty = appState.quantity;
  const unitPrice = variant.price;
  const subtotal = unitPrice * qty;
  const gstAmount = Math.round(subtotal - (subtotal / 1.18));

  // Update summary preview
  const thumb = document.getElementById('summaryThumb');
  const nameEl = document.getElementById('summaryVariantName');
  const qtyEl = document.getElementById('summaryQty');
  const singlePriceEl = document.getElementById('summarySinglePrice');
  const subtotalEl = document.getElementById('costSubtotal');
  const gstEl = document.getElementById('costGst');
  const totalEl = document.getElementById('costTotal');

  if (thumb) thumb.src = variant.image;
  if (nameEl) nameEl.textContent = variant.name;
  if (qtyEl) qtyEl.textContent = qty;
  if (singlePriceEl) singlePriceEl.textContent = `₹${unitPrice.toLocaleString('en-IN')} each`;
  if (subtotalEl) subtotalEl.textContent = `₹${subtotal.toLocaleString('en-IN')}`;
  if (gstEl) gstEl.textContent = `₹${gstAmount.toLocaleString('en-IN')}`;
  if (totalEl) totalEl.textContent = `₹${subtotal.toLocaleString('en-IN')}`;

  document.querySelectorAll('.payTotalDisplay').forEach(el => {
    el.textContent = `₹${subtotal.toLocaleString('en-IN')}`;
  });

  const halfPrice = Math.round(subtotal / 2);
  document.querySelectorAll('.payHalfDisplay').forEach(el => {
    el.textContent = `₹${halfPrice.toLocaleString('en-IN')}`;
  });
}

function goToCheckoutStep(stepNumber) {
  if (stepNumber === 2) {
    const nameInput = document.getElementById('custName');
    const phoneInput = document.getElementById('custPhone');
    const addrInput = document.getElementById('custAddress');
    const cityInput = document.getElementById('custCity');
    const pinInput = document.getElementById('custPin');

    if (nameInput && nameInput.value.trim()) appState.customer.name = nameInput.value.trim();
    if (phoneInput && phoneInput.value.trim()) appState.customer.phone = phoneInput.value.trim();
    if (addrInput && addrInput.value.trim()) appState.customer.address = addrInput.value.trim();
    if (cityInput && cityInput.value.trim()) appState.customer.city = cityInput.value.trim();
    if (pinInput && pinInput.value.trim()) appState.customer.pin = pinInput.value.trim();
  }

  [1, 2, 3].forEach(num => {
    const stepEl = document.getElementById(`checkoutStep${num}`);
    const tabEl = document.getElementById(`cStepTab${num}`);
    if (stepEl) stepEl.classList.toggle('active', num === stepNumber);
    if (tabEl) tabEl.classList.toggle('active', num <= stepNumber);
  });

  const container = document.querySelector('.checkout-modal-container');
  if (container) container.scrollTop = 0;
}

function switchPayTab(tabKey) {
  appState.selectedPaymentMethod = tabKey;
  ['upi', 'card', 'cod'].forEach(key => {
    const btn = document.getElementById(`tab${capitalize(key)}`);
    const content = document.getElementById(`content${capitalize(key)}`);
    if (btn) btn.classList.toggle('active', key === tabKey);
    if (content) content.classList.toggle('active', key === tabKey);
  });
}

/**
 * DUMMY PAYMENT GATEWAY PROCESSOR (CLIENT DEMO)
 * NOTE: Payment gateway is completely mocked for client review.
 * // TODO: integrate real payment gateway once client provides merchant account (Razorpay/PayU/Stripe)
 */
function processDummyPayment() {
  const placeBtn = document.getElementById('placeOrderBtn');
  if (!placeBtn) return;

  const origHtml = placeBtn.innerHTML;
  placeBtn.disabled = true;
  placeBtn.innerHTML = `<span>Processing Order...</span>`;

  setTimeout(() => {
    placeBtn.disabled = false;
    placeBtn.innerHTML = origHtml;

    const randomOrderId = '#ROTI-2026-' + Math.floor(1000 + Math.random() * 9000);
    const variant = appState.variants[appState.currentVariant];
    const total = (variant.price * appState.quantity).toLocaleString('en-IN');

    const nameEl = document.getElementById('confCustomerName');
    const orderIdEl = document.getElementById('confOrderId');
    const variantEl = document.getElementById('confVariant');
    const totalEl = document.getElementById('confTotal');
    const destEl = document.getElementById('confDestination');
    const waBtn = document.getElementById('confWhatsAppBtn');

    if (nameEl) nameEl.textContent = appState.customer.name;
    if (orderIdEl) orderIdEl.textContent = randomOrderId;
    if (variantEl) variantEl.textContent = `${variant.name} (${appState.quantity} Unit${appState.quantity > 1 ? 's' : ''})`;
    if (totalEl) totalEl.textContent = `₹${total} (Inclusive of 18% GST)`;
    if (destEl) destEl.textContent = `${appState.customer.city} (${appState.customer.pin})`;

    if (waBtn) {
      const waMsg = encodeURIComponent(
        `Hi Rotimatic Team, I have placed order ${randomOrderId} for ${variant.name} (Qty: ${appState.quantity}) to ${appState.customer.city}. Please confirm dispatch timeline.`
      );
      waBtn.href = `https://wa.me/919876543210?text=${waMsg}`;
    }

    goToCheckoutStep(3);
    showToast('🎉 Booking Confirmed Successfully!', 'orange');
  }, 1100);
}

/* ==========================================================================
   8. NAVIGATION & UTILITIES
   ========================================================================== */
function initNavigationScroll() {
  const links = document.querySelectorAll('.nav-link');
  const sections = document.querySelectorAll('section[id]');

  window.addEventListener('scroll', () => {
    let currentId = '';
    const scrollPosition = window.scrollY + 140;

    sections.forEach(section => {
      const top = section.offsetTop;
      const height = section.offsetHeight;
      if (scrollPosition >= top && scrollPosition < top + height) {
        currentId = section.getAttribute('id');
      }
    });

    links.forEach(link => {
      link.classList.remove('active');
      if (link.getAttribute('href') === `#${currentId}`) {
        link.classList.add('active');
      }
    });
  }, { passive: true });
}

function initMobileMenu() {
  const toggleBtn = document.getElementById('mobileMenuToggle');
  const navLinks = document.getElementById('navLinks');
  if (!toggleBtn || !navLinks) return;

  toggleBtn.addEventListener('click', () => {
    const isVisible = navLinks.style.display === 'flex';
    navLinks.style.display = isVisible ? 'none' : 'flex';
    if (!isVisible) {
      navLinks.style.flexDirection = 'column';
      navLinks.style.position = 'absolute';
      navLinks.style.top = '72px';
      navLinks.style.left = '0';
      navLinks.style.right = '0';
      navLinks.style.background = '#0a0a0c';
      navLinks.style.padding = '1.5rem 2rem';
      navLinks.style.borderBottom = '1px solid var(--border-medium)';
      navLinks.style.gap = '1.25rem';
    }
  });

  navLinks.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      if (window.innerWidth <= 768) {
        navLinks.style.display = 'none';
      }
    });
  });
}

function showToast(message, type = '') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast-msg ${type}`;
  toast.innerHTML = `<span>✨</span><span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
