(function() {
  'use strict';
  const ATTRS = ['placeholder', 'title', 'alt', 'aria-label'];
  const SKIP = 'script, style, textarea, pre, code, [contenteditable]:not([contenteditable="false"])';
  let dictionarySource;
  let dictionary = Object.create(null);

  function translateText(text) {
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
    if (!Object.prototype.hasOwnProperty.call(dictionary, key)) return text;
    const start = text.indexOf(key);
    return text.slice(0, start) + dictionary[key] + text.slice(start + key.length);
  }

  function translateNode(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      if (node.parentElement && node.parentElement.closest(SKIP)) return;
      const translated = translateText(node.nodeValue);
      if (translated !== node.nodeValue) {
        node.nodeValue = translated;
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      if (node.matches(SKIP)) return;
      ATTRS.forEach(attr => {
        if (node.hasAttribute(attr)) {
          const original = node.getAttribute(attr);
          const translated = translateText(original);
          if (translated !== original) {
            node.setAttribute(attr, translated);
          }
        }
      });
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
