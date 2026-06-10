/**
 * DisBoost Reply - 后台脚本
 */

// 监听安装事件
chrome.runtime.onInstalled.addListener(() => {
  console.log('[DisBoost] 插件已安装');

  // 设置默认配置
  chrome.storage.sync.set({
    enabled: true,
    quickReply: true
  });
});

// 监听来自 content script 的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getContent') {
    // 获取当前标签页内容
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        sendResponse({ url: tabs[0].url });
      }
    });
    return true;
  }
});
