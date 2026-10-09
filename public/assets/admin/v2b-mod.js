(function() {
  'use strict';
  const ATTRS = ['placeholder', 'title', 'alt', 'aria-label'];
  const SKIP = 'script, style, textarea, pre, code, [contenteditable]:not([contenteditable="false"])';
  let dictionarySource;
  let dictionary = Object.create(null);

  function translateText(text, element) {
    if (dictionarySource !== window.zhViDictionary) {
      dictionarySource = window.zhViDictionary;
      dictionary = Object.create(null);
      Object.entries(dictionarySource || {}).forEach(([key, value]) => {
        dictionary[key.trim()] = value;
      });
    }
    if (typeof text !== 'string') return text;
    const key = text.trim();
    if (key.startsWith('图标: ')) return text.replace('图标: ', 'Biểu tượng: ');
    // Ant Design builds these labels from dates/counts, so exact dictionary
    // entries cannot cover them. Restrict patterns to the relevant UI widgets.
    let dynamic;
    if (element && element.closest('[class*="ant-calendar"]')) {
      dynamic = key.replace(/^(\d{4})年(\d{1,2})月(\d{1,2})日$/, '$3/$2/$1')
        .replace(/^(\d{4})年$/, 'Năm $1');
    } else if (element && element.closest('.ant-pagination, .ant-select-dropdown')) {
      dynamic = key.replace(/^(\d+)\s*条\/页$/, '$1 / trang');
    } else if (element && element.closest('.ant-table-tbody')) {
      dynamic = key.replace(/^匹配\s*(\d+)\s*条规则$/, 'Khớp $1 quy tắc')
        .replace(/^(\d+(?:\.\d+)?)\s*天$/, '$1 ngày');
    } else if (element && element.closest('.ant-modal-title')) {
      dynamic = key.replace(/^配置(.+)主题$/, 'Cài đặt giao diện $1');
    }
    if (dynamic !== undefined && dynamic !== key) {
      const start = text.indexOf(key);
      return text.slice(0, start) + dynamic + text.slice(start + key.length);
    }
    if (!Object.prototype.hasOwnProperty.call(dictionary, key)) return text;
    const start = text.indexOf(key);
    return text.slice(0, start) + dictionary[key] + text.slice(start + key.length);
  }

  function translateNode(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      if (node.parentElement && node.parentElement.closest(SKIP)) return;
      const translated = translateText(node.nodeValue, node.parentElement);
      if (translated !== node.nodeValue) {
        node.nodeValue = translated;
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      if (node.matches('script, style')) return;
      ATTRS.forEach(attr => {
        if (node.hasAttribute(attr)) {
          const original = node.getAttribute(attr);
          const translated = translateText(original, node);
          if (translated !== original) {
            node.setAttribute(attr, translated);
          }
        }
      });
      // Translate a textarea's UI attributes, never its contents or value.
      if (node.matches(SKIP)) return;
      node.childNodes.forEach(translateNode);
    }
  }

  function translatePage() {
    translateNode(document.body);
  }

  function loadDictionary() {
    // vi-VN.js already provides the dictionary on normal installs.
    const dictionaryUrl = window.DICT_URL;
    if (typeof dictionaryUrl !== 'string' || !dictionaryUrl.trim()) {
      translatePage();
      return;
    }
    fetch(dictionaryUrl)
      .then(res => res.json())
      .then(dict => {
        window.zhViDictionary = dict;
        translatePage();
      })
      .catch(err => console.error(err));
  }

  window.addEventListener('load', loadDictionary);
  // React updates existing text/placeholder nodes as well as adding new nodes.
  // Never translate input values or editable content supplied by the user.
  const observer = new MutationObserver(records => {
    const nodes = new Set();
    records.forEach(record => {
      if (record.type === 'childList') record.addedNodes.forEach(node => nodes.add(node));
      else nodes.add(record.target);
    });
    nodes.forEach(translateNode);
  });
  observer.observe(document.body, { childList: true, characterData: true, attributes: true,
    attributeFilter: ATTRS, subtree: true });
})();
