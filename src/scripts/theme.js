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
const downloadLinks = Array.from(document.querySelectorAll('[data-download-link]'));
const downloadLabels = Array.from(document.querySelectorAll('[data-download-label]'));
const year = document.querySelector('[data-year]');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const fallbackReleaseUrl = 'https://github.com/ericcastro/dj-scrobbler/releases/latest';
const latestReleaseApiUrl = 'https://api.github.com/repos/ericcastro/dj-scrobbler/releases/latest';

let currentThemeId = 'neon-night';
let cycleTimer = null;
let isScreenshotVisible = false;

function platformInfo() {
  const platform = navigator.userAgentData?.platform || navigator.platform || '';
  const value = platform.toLowerCase();
  if (value.includes('mac')) return { id: 'macos', label: 'macOS' };
  if (value.includes('win')) return { id: 'windows', label: 'Windows' };
  if (value.includes('linux')) return { id: 'linux', label: 'Linux' };
  return { id: 'unknown', label: 'your platform' };
}

async function platformArch() {
  if (!navigator.userAgentData?.getHighEntropyValues) return '';

  try {
    const values = await navigator.userAgentData.getHighEntropyValues(['architecture', 'bitness']);
    return `${values.architecture || ''} ${values.bitness || ''}`.toLowerCase();
  } catch {
    return '';
  }
}

function isReleaseAsset(asset) {
  const name = asset.name.toLowerCase();
  return !name.endsWith('.blockmap') && !name.endsWith('.yml') && !name.endsWith('.yaml') && !name.endsWith('.json');
}

function assetScore(asset, platform, arch) {
  const name = asset.name.toLowerCase();
  let score = 0;

  if (!isReleaseAsset(asset)) return -1;

  if (platform === 'macos') {
    if (name.endsWith('.dmg')) score += 80;
    if (name.endsWith('.zip')) score += 35;
    if (name.includes('mac') || name.includes('darwin') || name.endsWith('.dmg')) score += 20;
    if (arch.includes('arm') && (name.includes('arm64') || name.includes('aarch64'))) score += 30;
    if (!arch.includes('arm') && (name.includes('x64') || name.includes('x86_64') || name.includes('amd64'))) score += 20;
    if (!name.includes('arm64') && !name.includes('x64') && !name.includes('x86_64') && !name.includes('amd64')) score += 8;
  }

  if (platform === 'windows') {
    if (name.endsWith('.exe')) score += 80;
    if (name.includes('setup')) score += 30;
    if (name.includes('win') || name.includes('windows')) score += 18;
    if (name.includes('portable')) score += 10;
  }

  if (platform === 'linux') {
    if (name.endsWith('.appimage')) score += 90;
    if (name.endsWith('.deb')) score += 55;
    if (name.includes('linux')) score += 20;
    if (name.includes('x86_64') || name.includes('amd64')) score += 10;
  }

  return score;
}

function chooseDownloadAsset(assets, platform, arch) {
  const candidates = assets
    .map((asset) => ({ asset, score: assetScore(asset, platform, arch) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  return candidates[0]?.asset || null;
}

async function resolveDownloadUrl(platform) {
  if (platform.id === 'unknown') return fallbackReleaseUrl;

  try {
    const [releaseResponse, arch] = await Promise.all([
      fetch(latestReleaseApiUrl, {
        headers: { Accept: 'application/vnd.github+json' },
      }),
      platformArch(),
    ]);

    if (!releaseResponse.ok) return fallbackReleaseUrl;

    const release = await releaseResponse.json();
    const asset = chooseDownloadAsset(release.assets || [], platform.id, arch);
    return asset?.browser_download_url || release.html_url || fallbackReleaseUrl;
  } catch {
    return fallbackReleaseUrl;
  }
}

async function updateDownloadLinks() {
  const platform = platformInfo();

  downloadLabels.forEach((downloadLabel) => {
    downloadLabel.textContent = `Download for ${platform.label}`;
  });

  if (releaseButton) {
    releaseButton.setAttribute('aria-label', `Download the latest DJ Scrobbler release for ${platform.label}`);
  }

  const downloadUrl = await resolveDownloadUrl(platform);
  downloadLinks.forEach((downloadLink) => {
    downloadLink.href = downloadUrl;
  });
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

updateDownloadLinks();

if (year) {
  year.textContent = String(new Date().getFullYear());
}
