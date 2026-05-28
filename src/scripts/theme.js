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
const downloadModal = document.querySelector('[data-download-modal]');
const downloadModalTitle = document.querySelector('[data-download-modal-title]');
const downloadBuildNote = document.querySelector('[data-download-build-note]');
const downloadBuildText = document.querySelector('[data-download-build-text]');
const downloadWhyTooltip = document.querySelector('[data-download-why-tooltip]');
const downloadModalSummary = document.querySelector('[data-download-modal-summary]');
const downloadSteps = document.querySelector('[data-download-steps]');
const downloadShot = document.querySelector('[data-download-shot]');
const downloadShotImage = document.querySelector('[data-download-shot-image]');
const downloadShotLabel = document.querySelector('[data-download-shot-label]');
const downloadManual = document.querySelector('[data-download-manual]');
const downloadClose = document.querySelector('[data-download-close]');
const year = document.querySelector('[data-year]');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const releasesUrl = 'https://github.com/ericcastro/dj-scrobbler/releases';
const releasesApiUrl = 'https://api.github.com/repos/ericcastro/dj-scrobbler/releases?per_page=10';
const quarantineHelpText =
  'This removes Apple\'s quarantine flag from DJ Scrobbler.app. macOS adds that flag to apps downloaded outside the App Store or from an unidentified developer. Removing it lets the app open after you decide you trust this official GitHub download.';

let currentThemeId = 'neon-night';
let cycleTimer = null;
let isScreenshotVisible = false;
let downloadInfoPromise = null;
let countdownTimer = null;

function basePlatformInfo() {
  const platform = navigator.userAgentData?.platform || navigator.platform || '';
  const value = platform.toLowerCase();
  if (value.includes('mac')) return { id: 'macos', label: 'macOS', arch: 'unknown' };
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

function webglRenderer() {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    const info = gl?.getExtension('WEBGL_debug_renderer_info');
    if (!gl || !info) return '';
    return String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL) || '').toLowerCase();
  } catch {
    return '';
  }
}

function normalizeArch(value) {
  const arch = value.toLowerCase();
  if (arch.includes('arm') || arch.includes('aarch')) return 'arm64';
  if (arch.includes('x86') || arch.includes('x64') || arch.includes('amd64') || arch.includes('intel')) return 'x64';
  return 'unknown';
}

async function detectedPlatform() {
  const platform = basePlatformInfo();
  if (platform.id !== 'macos') return platform;

  let arch = normalizeArch(await platformArch());
  if (arch === 'unknown') {
    const renderer = webglRenderer();
    if (renderer.includes('apple') && !renderer.includes('intel') && !renderer.includes('amd') && !renderer.includes('radeon')) {
      arch = 'arm64';
    } else if (renderer.includes('intel') || renderer.includes('amd') || renderer.includes('radeon')) {
      arch = 'x64';
    }
  }

  if (arch === 'arm64') return { ...platform, arch, label: 'macOS (Apple Silicon)' };
  if (arch === 'x64') return { ...platform, arch, label: 'macOS (Intel)' };
  return platform;
}

function isReleaseAsset(asset) {
  const name = asset.name.toLowerCase();
  return !name.endsWith('.blockmap') && !name.endsWith('.yml') && !name.endsWith('.yaml') && !name.endsWith('.json');
}

function assetScore(asset, platform) {
  const name = asset.name.toLowerCase();
  let score = 0;

  if (!isReleaseAsset(asset)) return -1;

  if (platform.id === 'macos') {
    const isArm = name.includes('arm64') || name.includes('aarch64');
    const isArchive = name.endsWith('.zip');

    if (name.endsWith('.dmg')) score += 100;
    if (isArchive) score += 35;
    if (name.includes('mac') || name.includes('darwin') || name.endsWith('.dmg')) score += 20;

    if (platform.arch === 'arm64') {
      if (isArm) score += 70;
      if (!isArm && !isArchive) score -= 25;
    } else if (platform.arch === 'x64') {
      if (isArm) score -= 120;
      if (!isArm) score += 50;
    } else {
      if (!isArm && !isArchive) score += 20;
      if (isArm) score += 8;
    }
  }

  if (platform.id === 'windows') {
    if (name.endsWith('.exe')) score += 80;
    if (name.includes('setup')) score += 50;
    if (name.includes('win') || name.includes('windows')) score += 18;
    if (name.includes('portable')) score -= 10;
  }

  if (platform.id === 'linux') {
    if (name.endsWith('.appimage')) score += 90;
    if (name.endsWith('.deb')) score += 55;
    if (name.includes('linux')) score += 20;
    if (name.includes('x86_64') || name.includes('amd64')) score += 10;
  }

  return score;
}

function chooseDownloadAsset(assets, platform) {
  const candidates = assets
    .map((asset) => ({ asset, score: assetScore(asset, platform) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  return candidates[0]?.asset || null;
}

function installCopy(platform) {
  if (platform.id === 'macos') {
    return {
      title: 'Download is starting... (please read!)',
      summary: 'Until DJ Scrobbler gets listed in the App Store, a few extra steps are required',
      steps: [        
        'Open the .dmg file, and copy DJ Scrobbler.app to Applications.',
        'If you try running the app and see the above warning, press Cancel.',
        'Open macOS app "Terminal" (Press Command-Space, type Terminal, then press Enter).',
        'In the Terminal window, paste this command and press Enter: xattr -dr com.apple.quarantine "/Applications/DJ Scrobbler.app"',
        'Open DJ Scrobbler again from Applications.',
      ],
      note: 'DJ Scrobbler is in public beta and distributed directly from GitHub.\n\nmacOS may claim the app is “damaged.” It isn’t - this is Apple not wanting to deal with the responsibility of "potentially malicious" software that didn\'t go through their own review process.\n\nDJ Scrobbler is open-source software. Everyone can see the source code and its actions on GitHub, exposing every build step so the missing layer of trust can be obtained without Apple\'s arbitrary opinion.',
      shot: {
        src: '/assets/macos-damaged-warning.png',
        alt: 'macOS warning saying DJ Scrobbler.app is damaged and cannot be opened.',
        label: 'If this appears, choose Cancel. Do not move the app to the Bin.',
      },
    };
  }

  if (platform.id === 'windows') {
    return {
      title: 'Download is starting... (please read!)',
      summary: 'DJ Scrobbler is a public beta. Because the app is new and unsigned, Microsoft Defender SmartScreen may show a warning.',
      steps: [
        'Run the downloaded Setup file.',
        'If SmartScreen appears, click More info.',
        'Click Run anyway, then finish the installer.',
      ],
      note: 'Windows may warn about new open-source apps until they build reputation or use paid code signing. Only continue when the file came from the official DJ Scrobbler GitHub release.',
      shot: {
        src: '/assets/windows-smartscreen.png',
        alt: 'Windows SmartScreen warning — click More info, then Run anyway.',
        label: 'Click More info, then Run anyway.',
      },
    };
  }

  if (platform.id === 'linux') {
    return {
      title: 'Download is starting... (please read!)',
      summary: 'DJ Scrobbler is a public beta. The AppImage download should run without a package manager.',
      steps: [
        'Save the AppImage file.',
        'Mark it as executable if your desktop asks.',
        'Open the AppImage to launch DJ Scrobbler.',
      ],
      shot: {
        src: '/assets/linux-permission.png',
        alt: 'Linux file manager prompt to mark the AppImage as executable.',
        label: 'Allow executing the file as a program when prompted.',
      },
      note: 'Some Linux desktops ask you to mark downloaded AppImages as executable before opening them. This is normal for standalone app files.',
    };
  }

  return {
    title: 'Download is starting... (please read!)',
    summary: 'DJ Scrobbler is a public beta. Choose the file that matches your operating system on GitHub Releases.',
    steps: [
      'Open the latest release.',
      'Download the file for your operating system.',
      'Follow the install prompt for your platform.',
    ],
    shot: {
      label: 'Placeholder for platform-specific setup screenshots.',
    },
    note: 'DJ Scrobbler is a public beta distributed through GitHub Releases, so your operating system may ask for extra confirmation before opening it.',
  };
}

function createTooltipLink(label, text, className = '') {
  const wrap = document.createElement('span');
  wrap.className = ['download-tooltip', className].filter(Boolean).join(' ');
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  const tooltip = document.createElement('span');
  tooltip.setAttribute('role', 'tooltip');
  renderTooltipText(tooltip, text);
  wrap.append(button, tooltip);
  return wrap;
}

function renderTooltipText(tooltip, text) {
  const paragraphs = String(text || '')
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  tooltip.replaceChildren();

  paragraphs.forEach((paragraph, paragraphIndex) => {
    const block = document.createElement('p');
    paragraph.split('\n').forEach((line, lineIndex) => {
      if (lineIndex > 0) block.append(document.createElement('br'));
      block.append(document.createTextNode(line));
    });
    tooltip.append(block);
    if (paragraphIndex < paragraphs.length - 1) tooltip.append(document.createTextNode(''));
  });
}

function latestRelease(releases) {
  return releases.find((release) => !release.draft) || null;
}

async function resolveDownloadInfo() {
  if (downloadInfoPromise) return downloadInfoPromise;

  downloadInfoPromise = (async () => {
    const platform = await detectedPlatform();

    if (platform.id === 'unknown') {
      return {
        platform,
        url: releasesUrl,
        fileName: 'Choose your platform on GitHub Releases',
        releaseUrl: releasesUrl,
        copy: installCopy(platform),
      };
    }

    try {
      const releaseResponse = await fetch(releasesApiUrl, {
        headers: { Accept: 'application/vnd.github+json' },
      });

      if (!releaseResponse.ok) throw new Error('Could not load releases');

      const releases = await releaseResponse.json();
      const release = latestRelease(releases);
      const asset = chooseDownloadAsset(release?.assets || [], platform);

      return {
        platform,
        url: asset?.browser_download_url || release?.html_url || releasesUrl,
        fileName: asset?.name || 'Choose your installer on GitHub Releases',
        releaseUrl: release?.html_url || releasesUrl,
        isPrerelease: Boolean(release?.prerelease),
        copy: installCopy(platform),
      };
    } catch {
      return {
        platform,
        url: releasesUrl,
        fileName: 'Choose your installer on GitHub Releases',
        releaseUrl: releasesUrl,
        copy: installCopy(platform),
      };
    }
  })();

  return downloadInfoPromise;
}

async function updateDownloadLinks() {
  const info = await resolveDownloadInfo();

  downloadLabels.forEach((downloadLabel) => {
    downloadLabel.textContent = `Download for ${info.platform.label}`;
  });

  if (releaseButton) {
    releaseButton.setAttribute('aria-label', `Download the latest DJ Scrobbler beta for ${info.platform.label}`);
  }

  downloadLinks.forEach((downloadLink) => {
    downloadLink.href = info.url;
  });

  if (downloadManual) downloadManual.href = info.url;
}

function triggerDownload(url) {
  if (!url || url === releasesUrl) return;

  const link = document.createElement('a');
  link.href = url;
  link.rel = 'noopener noreferrer';
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function renderDownloadModal(info) {
  const { copy } = info;

  if (downloadModalTitle) downloadModalTitle.textContent = copy.title;
  if (downloadBuildNote) {
    downloadBuildNote.hidden = info.platform.id === 'unknown';
  }
  if (downloadBuildText) {
    downloadBuildText.textContent = info.platform.id !== 'unknown' ? `Installation instructions for ${info.platform.label}.` : '';
  }
  if (downloadWhyTooltip) renderTooltipText(downloadWhyTooltip, copy.note || '');
  if (downloadModalSummary) {
    downloadModalSummary.textContent = copy.summary;
  }
  if (downloadShot) {
    downloadShot.hidden = !copy.shot;
    downloadShot.dataset.platform = info.platform.id;
  }
  if (downloadShotImage) {
    if (copy.shot?.src) {
      downloadShotImage.src = copy.shot.src;
      downloadShotImage.alt = copy.shot.alt || '';
      downloadShotImage.hidden = false;
    } else {
      downloadShotImage.removeAttribute('src');
      downloadShotImage.alt = '';
      downloadShotImage.hidden = true;
    }
  }
  if (downloadShotLabel) downloadShotLabel.textContent = copy.shot?.label || '';
  if (downloadManual) downloadManual.href = info.url;

  if (downloadSteps) {
    const stepItems = copy.steps.map((step) => {
      const item = document.createElement('li');
      if (step.includes('xattr ')) {
        const [prefix, command] = step.split(': ');
        item.append(`${prefix}: `);
        const commandWrap = document.createElement('span');
        commandWrap.className = 'download-command';
        const code = document.createElement('code');
        code.textContent = command;
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = 'Copy';
        button.addEventListener('click', async () => {
          try {
            await navigator.clipboard.writeText(command);
            button.textContent = 'Copied';
            window.setTimeout(() => {
              button.textContent = 'Copy';
            }, 1600);
          } catch {
            button.textContent = 'Select text';
          }
        });
        commandWrap.append(code, button, createTooltipLink('What is this doing?', quarantineHelpText, 'download-command-help'));
        item.append(commandWrap);
      } else {
        item.textContent = step;
      }
      return item;
    });
    downloadSteps.replaceChildren(...stepItems);
  }
}

function setCountdownTitle(baseTitle, seconds) {
  if (!downloadModalTitle) return;
  if (seconds > 0) {
    downloadModalTitle.textContent = baseTitle.replace('is starting...', `is starting in ${seconds}s...`);
  } else {
    downloadModalTitle.textContent = baseTitle.replace('is starting...', 'started');
  }
}

function startDownloadCountdown(info) {
  window.clearInterval(countdownTimer);

  let seconds = 4;
  const baseTitle = info.copy.title;
  setCountdownTitle(baseTitle, seconds);

  countdownTimer = window.setInterval(() => {
    seconds -= 1;

    if (seconds <= 0) {
      window.clearInterval(countdownTimer);
      countdownTimer = null;
      triggerDownload(info.url);
      setCountdownTitle(baseTitle, 0);
    } else {
      setCountdownTitle(baseTitle, seconds);
    }
  }, 1000);
}

function openDownloadModal(info) {
  if (!downloadModal) {
    window.location.href = info.url;
    return;
  }

  renderDownloadModal(info);
  if (typeof downloadModal.showModal === 'function') {
    downloadModal.showModal();
  } else {
    downloadModal.setAttribute('open', '');
  }
  startDownloadCountdown(info);
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

downloadLinks.forEach((downloadLink) => {
  downloadLink.addEventListener('click', async (event) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    event.preventDefault();
    const info = await resolveDownloadInfo();
    openDownloadModal(info);
  });
});

downloadManual?.addEventListener('click', async () => {
  window.clearInterval(countdownTimer);
  countdownTimer = null;
  const info = await resolveDownloadInfo();
  if (downloadModalTitle) downloadModalTitle.textContent = info.copy.title;
});

downloadClose?.addEventListener('click', () => {
  window.clearInterval(countdownTimer);
  countdownTimer = null;
  if (typeof downloadModal?.close === 'function') {
    downloadModal.close();
  } else {
    downloadModal?.removeAttribute('open');
  }
});

downloadModal?.addEventListener('cancel', () => {
  window.clearInterval(countdownTimer);
  countdownTimer = null;
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
