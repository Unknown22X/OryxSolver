// Injection logic for identifying questions on popular platforms and injecting the Oryx Logo inline.

interface SiteConfig {
  name: string;
  hostRegex: RegExp;
  questionSelector: string;
  titleSelector?: string; // Optional: specific element inside the container holding the actual question text
}

const SUPPORTED_SITES: SiteConfig[] = [
  {
    name: 'Google Forms',
    hostRegex: /docs\.google\.com\/forms/,
    // Google forms question block container
    questionSelector: 'div[jsmodel="CP1oW"]',
    titleSelector: 'div[role="heading"]',
  },
  {
    name: 'Microsoft Forms',
    hostRegex: /forms\.office\.com/,
    // Common MS forms question container
    questionSelector: '.office-form-question, .question-title-box',
    titleSelector: '.question-title',
  },
  {
    name: 'Canvas',
    hostRegex: /instructure\.com/,
    questionSelector: '.question, .display_question',
    titleSelector: '.question_text',
  }
];

function getCurrentSiteConfig(): SiteConfig | null {
  const url = window.location.href;
  for (const site of SUPPORTED_SITES) {
    if (site.hostRegex.test(url)) {
      return site;
    }
  }
  return null; // Unsupported site for inline injection, highlight extraction will still work
}

function injectLogo(element: HTMLElement, config: SiteConfig) {
  if (element.dataset.oryxInjected === "true") return;
  element.dataset.oryxInjected = "true";

  // Create a shadow host for isolation
  const shadowHost = document.createElement('div');
  shadowHost.className = 'oryx-inline-injector';
  shadowHost.style.display = 'inline-flex';
  shadowHost.style.alignItems = 'center';
  shadowHost.style.marginLeft = '8px';
  shadowHost.style.verticalAlign = 'middle';
  
  const shadowRoot = shadowHost.attachShadow({ mode: 'open' });
  
  // Create logo button
  const button = document.createElement('button');
  button.innerHTML = `
    <img src="${chrome.runtime.getURL('public/icons/32.png')}" alt="Solve with Oryx" style="width: 16px; height: 16px; border-radius: 4px;" />
    <span style="font-size: 10px; font-weight: bold; margin-left: 4px; display: none;">Solve</span>
  `;
  button.style.cssText = `
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: 1px solid rgba(0,0,0,0.1);
    border-radius: 6px;
    padding: 2px 4px;
    cursor: pointer;
    box-shadow: 0 2px 4px rgba(0,0,0,0.05);
    transition: all 0.2s;
  `;

  // Hover effects
  button.addEventListener('mouseenter', () => {
    button.style.borderColor = '#6366f1';
    button.style.backgroundColor = 'rgba(99, 102, 241, 0.05)';
    const span = button.querySelector('span');
    if (span) {
      span.style.display = 'inline';
      span.style.color = '#6366f1';
    }
  });
  
  button.addEventListener('mouseleave', () => {
    button.style.borderColor = 'rgba(0,0,0,0.1)';
    button.style.backgroundColor = 'transparent';
    const span = button.querySelector('span');
    if (span) {
      span.style.display = 'none';
      span.style.color = 'inherit';
    }
  });

  // Solve Action
  button.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Extract text
    let questionText = element.innerText;
    if (config.titleSelector) {
        const titleEl = element.querySelector(config.titleSelector);
        if (titleEl) questionText = (titleEl as HTMLElement).innerText;
    }

    button.innerHTML = `<span style="font-size:10px; font-weight:bold; color:#6366f1; white-space:nowrap; padding:2px">Sent to Oryx...</span>`;
    
    // Send to SidePanel for extraction / solving
    chrome.runtime.sendMessage({
      type: 'INLINE_EXTRACT_QUESTION',
      payload: {
        text: questionText.trim()
      }
    });
    
    // Reset after 2s
    setTimeout(() => {
        button.innerHTML = `<img src="${chrome.runtime.getURL('public/icons/32.png')}" style="width: 16px; height: 16px; border-radius: 4px;" />`;
    }, 2000);
  });

  shadowRoot.appendChild(button);

  // Position it next to the title or inside the container
  let targetNode = element;
  if (config.titleSelector) {
    const titleEl = element.querySelector(config.titleSelector);
    if (titleEl) targetNode = titleEl as HTMLElement;
  }
  
  targetNode.appendChild(shadowHost);
}

function observeDOM(config: SiteConfig) {
  const processMutations = () => {
    const questions = document.querySelectorAll(config.questionSelector);
    questions.forEach(q => {
        injectLogo(q as HTMLElement, config);
    });
  };

  const observer = new MutationObserver(() => {
    // Basic throttle/debounce could be added, but simple queries are fast
    processMutations();
  });

  observer.observe(document.body, { childList: true, subtree: true });
  processMutations(); // initial run
}

function initInjector() {
  const config = getCurrentSiteConfig();
  if (config) {
    console.log(`[Oryx] Injector activated for ${config.name}`);
    observeDOM(config);
  }
}

// Start strictly when body is ready
if (document.body) {
  initInjector();
} else {
  document.addEventListener('DOMContentLoaded', initInjector);
}
