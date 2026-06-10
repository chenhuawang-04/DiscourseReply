/**
 * DisBoost Reply - 弹出界面脚本
 */

document.addEventListener('DOMContentLoaded', () => {
  // 获取 DOM 元素
  const statusDot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');
  const enablePlugin = document.getElementById('enablePlugin');
  const autoQuote = document.getElementById('autoQuote');
  const refreshBtn = document.getElementById('refreshBtn');

  // 加载保存的设置
  loadSettings();

  // 检测当前页面状态
  checkPageStatus();

  // 事件监听
  enablePlugin.addEventListener('change', saveSettings);
  autoQuote.addEventListener('change', saveSettings);
  refreshBtn.addEventListener('click', refreshPage);

  /**
   * 加载设置
   */
  function loadSettings() {
    chrome.storage.sync.get(['enabled', 'autoQuote'], (result) => {
      enablePlugin.checked = result.enabled !== false;
      autoQuote.checked = result.autoQuote !== false;
    });
  }

  /**
   * 保存设置
   */
  function saveSettings() {
    chrome.storage.sync.set({
      enabled: enablePlugin.checked,
      autoQuote: autoQuote.checked
    });

    // 通知 content script 更新
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'updateSettings',
          settings: {
            enabled: enablePlugin.checked,
            autoQuote: autoQuote.checked
          }
        });
      }
    });
  }

  /**
   * 检测页面状态
   */
  function checkPageStatus() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        const url = tabs[0].url || '';

        // 检查是否为 Discourse 论坛
        if (url.includes('/t/') || url.includes('/c/')) {
          statusText.textContent = 'Discourse 论坛已检测';
          statusDot.classList.remove('inactive');
        } else if (url.startsWith('http')) {
          statusText.textContent = '可能不是 Discourse 论坛';
          statusDot.classList.add('inactive');
        } else {
          statusText.textContent = '无法检测页面';
          statusDot.classList.add('inactive');
        }
      }
    });
  }

  /**
   * 刷新页面
   */
  function refreshPage() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.reload(tabs[0].id);
        window.close();
      }
    });
  }
});
