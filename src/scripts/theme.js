const themes = [
  {
    id: 'neon-night',
    label: 'Neon Night',
    icon: '/assets/dj-scrobbler-icon-neon-night.svg',
    screenshot: '/assets/screenshot-neon-night.png',
  },
  {
    id: 'signal-teal',
    label: 'Signal Teal',
    icon: '/assets/dj-scrobbler-icon-signal-teal.svg',
    screenshot: '/assets/screenshot-signal-teal.png',
  },
  {
    id: 'sunset-deck',
    label: 'Sunset Deck',
    icon: '/assets/dj-scrobbler-icon-sunset-deck.svg',
    screenshot: '/assets/screenshot-sunset-deck.png',
  },
];

const root = document.documentElement;
const themeButtons = Array.from(document.querySelectorAll('[data-theme-option]'));
const themeIcons = Array.from(document.querySelectorAll('[data-theme-icon]'));
const themeScreenshots = Array.from(document.querySelectorAll('[data-theme-screenshot]'));
const themeName = document.querySelector('[data-theme-name]');
const screenshotCard = document.querySelector('.screenshot-card');
const screenshotStage = document.querySelector('[data-theme-stage]');
const releaseButton = document.querySelector('[data-release-button]');
const downloadLabels = Array.from(document.querySelectorAll('[data-download-label]'));
const year = document.querySelector('[data-year]');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let currentThemeId = 'neon-night';
let cycleTimer = null;
let isScreenshotVisible = false;

function platformName() {
  const platform = navigator.userAgentData?.platform || navigator.platform || '';
  const value = platform.toLowerCase();
  if (value.includes('mac')) return 'macOS';
  if (value.includes('win')) return 'Windows';
  if (value.includes('linux')) return 'Linux';
  return 'your platform';
}

function setTheme(id, options = {}) {
  const { animate = false, persist = true } = options;
  const theme = themes.find((item) => item.id === id) || themes[0];
  const shouldAnimate = animate && !reducedMotion && theme.id !== currentThemeId;
  currentThemeId = theme.id;

  if (shouldAnimate) {
    screenshotCard?.classList.add('is-fading');
    themeName?.classList.add('is-fading');
  }

  root.dataset.theme = theme.id;
  if (persist) {
    localStorage.setItem('dj-scrobbler-theme', theme.id);
  }

  themeButtons.forEach((button) => {
    const isActive = button.dataset.themeOption === theme.id;
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-pressed', String(isActive));
  });

  themeIcons.forEach((themeIcon) => {
    if (themeIcon instanceof HTMLImageElement) {
      themeIcon.src = theme.icon;
      themeIcon.alt = `DJ Scrobbler ${theme.label} app icon`;
    }
  });

  const swapScreenshots = () => {
    themeScreenshots.forEach((themeScreenshot) => {
      if (themeScreenshot instanceof HTMLImageElement) {
        themeScreenshot.src = theme.screenshot;
        if (themeScreenshot.dataset.themeScreenshotAlt !== undefined) {
          themeScreenshot.alt = `DJ Scrobbler desktop app in the ${theme.label} theme`;
        }
      }
    });
  };

  if (shouldAnimate) {
    window.setTimeout(() => {
      swapScreenshots();
      if (themeName) {
        themeName.textContent = theme.label;
      }
      window.requestAnimationFrame(() => screenshotCard?.classList.remove('is-fading'));
      window.requestAnimationFrame(() => themeName?.classList.remove('is-fading'));
    }, 190);
  } else {
    swapScreenshots();
    if (themeName) {
      themeName.textContent = theme.label;
    }
  }
}

function nextThemeId() {
  const index = themes.findIndex((theme) => theme.id === currentThemeId);
  return themes[(index + 1) % themes.length].id;
}

function startThemeCycle() {
  if (cycleTimer || reducedMotion || !isScreenshotVisible) return;
  cycleTimer = window.setInterval(() => {
    if (!isScreenshotVisible) return;
    setTheme(nextThemeId(), { animate: true, persist: false });
  }, 4200);
}

function stopThemeCycle() {
  if (!cycleTimer) return;
  window.clearInterval(cycleTimer);
  cycleTimer = null;
}

themeButtons.forEach((button) => {
  button.addEventListener('click', () => {
    setTheme(button.dataset.themeOption, { animate: true });
  });
});

const savedTheme = localStorage.getItem('dj-scrobbler-theme');
setTheme(savedTheme || 'neon-night');

if ('IntersectionObserver' in window && screenshotStage) {
  const observer = new IntersectionObserver(
    (entries) => {
      const [entry] = entries;
      isScreenshotVisible = Boolean(entry?.isIntersecting && entry.intersectionRatio > 0.35);
      if (isScreenshotVisible) {
        startThemeCycle();
      } else {
        stopThemeCycle();
      }
    },
    { threshold: [0, 0.35, 0.6] },
  );

  observer.observe(screenshotStage);
} else {
  isScreenshotVisible = true;
  startThemeCycle();
}

downloadLabels.forEach((downloadLabel) => {
  downloadLabel.textContent = `Download for ${platformName()}`;
});

if (releaseButton) {
  releaseButton.setAttribute('aria-label', `Open the latest DJ Scrobbler release for ${platformName()}`);
}

if (year) {
  year.textContent = String(new Date().getFullYear());
}
