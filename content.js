/**
 * DisBoost Reply - 在 Discourse Boost 按钮旁添加快速回复功能
 * 点击后：触发主题回复 + 引用 boost 内容 + @对应用户
 */

(function() {
  'use strict';

  // 配置
  const CONFIG = {
    // Boost 气泡选择器（从截图中确认的结构）
    boostBubbleSelector: 'span.discourse-boosts__bubble',
    // Boost 内容按钮
    boostContentSelector: 'button.discourse-boosts__cooked',
    // 用户链接
    userLinkSelector: 'a[data-user-card]',
    // 回复按钮的类名
    replyButtonClass: 'disboost-reply-btn',
    // 检查间隔
    observerInterval: 1000,
    // 最大检查次数
    maxChecks: 50
  };

  let observer = null;
  let checkCount = 0;

  /**
   * 初始化插件
   */
  function init() {
    console.log('[DisBoost] 插件已加载');

    // 等待页面加载完成
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', startObserving);
    } else {
      startObserving();
    }

    // 监听来自 popup 的消息
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'updateSettings') {
        console.log('[DisBoost] 设置已更新:', request.settings);
        sendResponse({ success: true });
      }
      return true;
    });
  }

  /**
   * 开始监听 DOM 变化
   */
  function startObserving() {
    // 先尝试查找一次
    findAndEnhanceBoostButtons();

    // 使用 MutationObserver 监听动态内容
    observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.addedNodes.length > 0) {
          findAndEnhanceBoostButtons();
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // 备用定时检查
    const intervalId = setInterval(() => {
      checkCount++;
      findAndEnhanceBoostButtons();

      if (checkCount >= CONFIG.maxChecks) {
        clearInterval(intervalId);
      }
    }, CONFIG.observerInterval);
  }

  /**
   * 查找并增强所有 boost 气泡
   */
  function findAndEnhanceBoostButtons() {
    // 查找所有 boost 气泡
    const boostBubbles = document.querySelectorAll(CONFIG.boostBubbleSelector);

    boostBubbles.forEach(bubble => {
      // 避免重复添加
      if (!bubble.querySelector(`.${CONFIG.replyButtonClass}`)) {
        addReplyButton(bubble);
      }
    });
  }

  /**
   * 在 boost 气泡内添加回复按钮
   */
  function addReplyButton(boostBubble) {
    // 创建回复按钮
    const replyBtn = document.createElement('button');
    replyBtn.className = CONFIG.replyButtonClass;
    replyBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
    replyBtn.title = '回复并引用此 Boost';
    replyBtn.setAttribute('aria-label', '快速回复此 Boost');

    // 添加点击事件
    replyBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      handleBoostReply(boostBubble);
    });

    // 插入按钮（在气泡内部最后）
    boostBubble.appendChild(replyBtn);
  }

  /**
   * 处理 Boost 回复操作
   */
  function handleBoostReply(boostBubble) {
    console.log('[DisBoost] 触发 Boost 回复');

    // 提取 boost 信息
    const boostInfo = extractBoostInfo(boostBubble);

    if (!boostInfo) {
      console.warn('[DisBoost] 无法获取 Boost 信息');
      return;
    }

    console.log('[DisBoost] 提取的信息:', boostInfo);

    // 触发主题回复功能
    triggerTopicReply(boostInfo);
  }

  /**
   * 提取 Boost 相关信息
   */
  function extractBoostInfo(boostBubble) {
    try {
      // 获取用户名（从 data-user-card 属性）
      const userLink = boostBubble.querySelector(CONFIG.userLinkSelector);
      const username = userLink ? userLink.dataset.userCard : '';

      // 获取 boost 内容
      const contentBtn = boostBubble.querySelector(CONFIG.boostContentSelector);
      const content = contentBtn ? contentBtn.textContent.trim() : '';

      // 获取帖子容器
      const postContainer = boostBubble.closest('.topic-post, .post, article, [data-post-number]');

      // 获取帖子 ID
      const postId = postContainer?.dataset?.postNumber || postContainer?.dataset?.postId || '';

      // 获取主题标题
      const titleEl = document.querySelector('.topic-title, h1.title, #topic-title');
      const topicTitle = titleEl ? titleEl.textContent.trim() : '';

      return {
        username,
        content,
        postId,
        topicTitle
      };
    } catch (error) {
      console.error('[DisBoost] 提取信息失败:', error);
      return null;
    }
  }

  /**
   * 触发主题回复
   */
  function triggerTopicReply(boostInfo) {
    const { username, content } = boostInfo;

    // 构建回复内容
    let replyContent = '';

    // 添加引用
    if (content) {
      replyContent = `> @${username}\n> ${content}\n\n`;
    } else if (username) {
      replyContent = `@${username} `;
    }

    // 尝试使用 Discourse API 或触发 UI 交互
    if (isDiscourseForum()) {
      triggerDiscourseReply(replyContent, username);
    } else {
      // 通用方案：复制到剪贴板并提示
      fallbackReply(replyContent, username);
    }
  }

  /**
   * 检测是否为 Discourse 论坛
   */
  function isDiscourseForum() {
    return !!(
      window.Discourse ||
      document.querySelector('#main-outlet') ||
      document.querySelector('.ember-application') ||
      document.querySelector('[data-discourse-setup]')
    );
  }

  /**
   * 触发 Discourse 原生回复功能
   */
  function triggerDiscourseReply(content, username) {
    try {
      // 方法 1: 使用 Discourse API
      if (window.Discourse && window.Discourse.__container__) {
        const controller = window.Discourse.__container__.lookup('controller:composer');
        if (controller) {
          controller.open({
            action: 'reply',
            draftKey: 'new_topic',
            reply: content
          });
          showNotification(`已打开回复框，将 @${username}`);
          console.log('[DisBoost] 已通过 Discourse API 触发回复');
          return;
        }
      }

      // 方法 2: 查找原生回复按钮并点击
      const nativeReplyBtn = findNativeReplyButton();

      if (nativeReplyBtn) {
        // 先点击回复按钮打开编辑器
        nativeReplyBtn.click();

        // 等待编辑器打开后填充内容
        setTimeout(() => {
          if (fillComposerContent(content)) {
            showNotification(`已打开回复框，将 @${username}`);
          } else {
            // 编辑器已打开但填充失败，复制到剪贴板
            fallbackReply(content, username);
          }
        }, 800);

        console.log('[DisBoost] 已通过点击回复按钮触发');
        return;
      }

      // 方法 3: 直接尝试填充编辑器（如果已经打开）
      if (fillComposerContent(content)) {
        showNotification(`已填充回复内容，将 @${username}`);
        return;
      }

      // 所有方法都失败，使用回退方案
      fallbackReply(content, username);

    } catch (error) {
      console.error('[DisBoost] 触发 Discourse 回复失败:', error);
      fallbackReply(content, username);
    }
  }

  /**
   * 查找原生回复按钮
   */
  function findNativeReplyButton() {
    const selectors = [
      '.topic-post.selected .reply',
      '.btn-primary.reply-button',
      'button[aria-label="Reply to post"]',
      '.post-controls .reply',
      'button.reply',
      '#reply-button'
    ];

    for (const selector of selectors) {
      const btn = document.querySelector(selector);
      if (btn) return btn;
    }

    // 尝试查找包含"回复"文本的按钮
    for (const el of document.querySelectorAll('button, a')) {
      if (el.textContent.includes('回复') || el.textContent.toLowerCase() === 'reply') {
        return el;
      }
    }

    return null;
  }

  /**
   * 填充 Discourse 编辑器内容
   */
  function fillComposerContent(content) {
    const composerSelectors = [
      '.composer-popup textarea',
      '#reply-control textarea',
      '.reply-area textarea',
      'textarea.ember-text-area',
      '#composer textarea',
      '.composer textarea'
    ];

    for (const selector of composerSelectors) {
      const textarea = document.querySelector(selector);
      if (textarea && textarea.offsetParent !== null) { // 确保可见
        // 设置值
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
          window.HTMLTextAreaElement.prototype, 'value'
        ).set;

        nativeInputValueSetter.call(textarea, content);
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        textarea.dispatchEvent(new Event('change', { bubbles: true }));

        // 聚焦并移动光标到末尾
        textarea.focus();
        textarea.setSelectionRange(textarea.value.length, textarea.value.length);

        console.log('[DisBoost] 已填充编辑器内容');
        return true;
      }
    }

    return false;
  }

  /**
   * 通用回退方案：复制到剪贴板
   */
  function fallbackReply(content, username) {
    navigator.clipboard.writeText(content).then(() => {
      showNotification(`已复制回复内容 (@${username})，请粘贴到回复框`);
    }).catch(err => {
      console.error('[DisBoost] 复制失败:', err);
      // 最后回退：显示提示框
      prompt('复制以下内容到回复框:', content);
    });
  }

  /**
   * 显示通知
   */
  function showNotification(message) {
    // 移除旧通知
    const oldNotification = document.querySelector('.disboost-notification');
    if (oldNotification) {
      oldNotification.remove();
    }

    const notification = document.createElement('div');
    notification.className = 'disboost-notification';
    notification.textContent = message;

    document.body.appendChild(notification);

    // 3秒后移除
    setTimeout(() => {
      notification.classList.add('disboost-fade-out');
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  // 启动插件
  init();
})();
