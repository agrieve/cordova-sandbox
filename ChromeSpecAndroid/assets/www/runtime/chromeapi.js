/*! Cordova for Chrome - v0.1.0 - 2012-11-15
* http://github.com/MobileChromeApps/
* Copyright (c) 2012 Google Inc.; Licensed MIT */

// Prefix file for Grunt build. Included before all modules, and sets them up.

(function() {
  if (window.chrome && chrome.mobile) {
    console.log('WARNING - chrome apis doubly included.');
    return;
  }

  var require, define;
  var modules = {};
  (function() {
    define = function define(name, fn) {
      if (modules[name]) {
        console.log('WARNING - duplicate definition of module: ' + name);
        return;
      }
      modules[name] = fn;
    }

    var resolving = {};
    require = function require(target) {
      // Look up the module.
      var mod = modules[target];
      if (!mod) {
        console.error('No such module: ' + target);
        return;
      }
      if (resolving[target]) {
        console.error('Circular require(): ' + target + ' included twice.');
        return;
      }

      if (typeof mod == 'function') {
        // Prevent circular requires.
        resolving[target] = true;

        // This layer of indirection is present so that the module code can change exports to point to something new, like a function.
        var module = {};
        module.exports = {};
        mod(require, module);
        modules[target] = module;

        // No longer resolving this module.
        delete resolving[target];

        return module.exports;
        // Each module is a singleton run only once, and this allows static data.
      } else if (typeof mod == 'object') {
        return mod.exports;
      } else {
        console.error('unsupported module type: ' + typeof mod);
      }
    };
  })();

  function unsupportedApi(name) {
    return function() {
      console.warn('API is not supported on mobile: ' + name);
    }
  }


// chrome.app.runtime

define('chrome.app.runtime', function(require, module) {
  var events = require('helpers.events');
  var exports = module.exports;
  exports.onLaunched = {};
  exports.onLaunched.addListener = events.addListener('onLaunched');
  exports.onLaunched.fire = events.fire('onLaunched');
});


define('chrome.app.window', function(require, module) {
  var events = require('helpers.events');
  var mobile = require('chrome.mobile.impl');
  var exports = module.exports;

  // The AppWindow created by chrome.app.window.create.
  var createdAppWindow = null;
  var dummyNode = document.createElement('a');

  function AppWindow() {
    this.contentWindow = mobile.fgWindow;
    this.id = '';
  }
  AppWindow.prototype = {
    restore: unsupportedApi('AppWindow.restore'),
    moveTo: unsupportedApi('AppWindow.moveTo'),
    clearAttention: unsupportedApi('AppWindow.clearAttention'),
    minimize: unsupportedApi('AppWindow.minimize'),
    drawAttention: unsupportedApi('AppWindow.drawAttention'),
    focus: unsupportedApi('AppWindow.focus'),
    resizeTo: unsupportedApi('AppWindow.resizeTo'),
    maximize: unsupportedApi('AppWindow.maximize'),
    close: unsupportedApi('AppWindow.close'),
    onClosed: { addListener: events.addListener('onClosed') }
  };

  function copyAttributes(srcNode, destNode) {
    var attrs = srcNode.attributes;
    for (var i = 0, attr; attr = attrs[i]; ++i) {
      destNode.setAttribute(attr.name, attr.value);
    }
  }

  function applyAttributes(attrText, destNode) {
    dummyNode.innerHTML = '<a ' + attrText + '>';
    copyAttributes(dummyNode.firstChild, destNode);
  }

  function evalScripts(rootNode) {
    var scripts = rootNode.getElementsByTagName('script');
    var doc = rootNode.ownerDocument;
    for (var i = 0, script; script = scripts[i]; ++i) {
      var replacement = doc.createElement('script');
      copyAttributes(script, replacement);
      // Don't bother with copying the innerHTML since chrome apps do not
      // support inline scripts.
      script.parentNode.replaceChild(replacement, script);
    }
  }

  function rewritePage(pageContent) {
    var fgBody = mobile.fgWindow.document.body;
    var fgHead = fgBody.previousElementSibling;

    var startIndex = pageContent.search(/<html([\s\S]*?)>/i);
    if (startIndex == -1) {
      mobile.eventIframe.insertSiblingHTML(pageContent);
    } else {
      startIndex = startIndex + RegExp.lastMatch.length;
      // Copy over the attributes of the <html> tag.
      applyAttributes(RegExp.lastParen, fgBody.parentNode);

      var endIndex = pageContent.search(/<\/head\s*>/i);
      var headHtml = pageContent.slice(startIndex, endIndex);
      pageContent = pageContent.slice(endIndex + RegExp.lastMatch.length);

      // Remove the <head> tag, and copy over its attributes.
      headHtml = headHtml.replace(/<head\b([\s\S]*?)>/i, '');
      applyAttributes(RegExp.lastParen, fgHead);

      headHtml = '<link rel="stylesheet" href="chromeappstyles.css">\n' + headHtml;
      // fgHead.innerHTML causes a DOMException on Android 2.3.
      while (fgHead.lastChild) {
        fgHead.removeChild(fgHead.lastChild);
      }
      fgHead.insertAdjacentHTML('beforeend', headHtml);
      evalScripts(fgHead);

      // Copy the <body> tag attributes.
      pageContent.search(/<body([\s\S]*?)>/i);
      applyAttributes(RegExp.lastParen, fgBody);
      // Don't bother removing the <body>, </body>, </html>. The browser's sanitizer removes them for us.
      mobile.eventIframe.insertAdjacentHTML('afterend', pageContent);
      evalScripts(fgBody);
    }
  }

  exports.create = function(filePath, options, callback) {
    if (createdAppWindow) {
      console.log('ERROR - chrome.app.window.create called multiple times. This is unsupported.');
      return;
    }
    createdAppWindow = new AppWindow();
    var xhr = new XMLHttpRequest();
    xhr.open('GET', filePath, true);
    xhr.onreadystatechange = function() {
      if (xhr.readyState == 4) {
        // Call the callback before the page contents loads.
        if (callback) {
          callback(createdAppWindow);
        }
        var pageContent = xhr.responseText || 'Page load failed.';
        rewritePage(pageContent);
        cordova.fireWindowEvent('DOMContentReady');
        cordova.fireWindowEvent('load');
      }
    };
    xhr.send();
  };

  exports.current = function() {
    return window == mobile.fgWindow ? createdAppWindow : null;
  };
});

define('chrome.mobile.impl', function(require, module) {
  var exports = module.exports;

  exports.init = function(fgWindow, eventIframe) {
    exports.fgWindow = fgWindow;
    exports.bgWindow = eventIframe.contentWindow;
    exports.eventIframe = eventIframe;
    exports.bgWindow.chrome = window.chrome;
  };
});

define('chrome.runtime', function(require, module) {
  var events = require('helpers.events');
  var exports = module.exports;
  exports.onSuspend = {};

  exports.onSuspend.fire = events.fire('onSuspend');

  // Uses a trampoline to bind the Cordova pause event on the first call.
  exports.onSuspend.addListener = function(f) {
    window.document.addEventListener('pause', exports.onSuspend.fire, false);
    var h = events.addListener('onSuspend');
    console.log('sub-handler type: ' + typeof h);
    exports.onSuspend.addListener = h;
    exports.onSuspend.addListener(f);
  };
});


define('chrome.storage', function(require, module) {
  function StorageArea() {
  }

  StorageArea.prototype = {
      getBytesInUse: unsupportedApi('StorageArea.getBytesInUse')
  };

  StorageArea.prototype.clear = function(callback) {
    localStorage.clear();
    if (callback) {
      callback();
    }
  };
  
  StorageArea.prototype.set = function(items, callback) {
    for (var key in items) {
      localStorage.setItem(key, JSON.stringify(items[key]));
    }
    if (callback) {
      callback();
    }
  };
  
  StorageArea.prototype.remove = function(keys, callback) {
    if (typeof keys === 'string') {
      keys = [keys];
    }
    for (var key in keys) {
      localStorage.removeItem(key);
    }
    if (callback) {
      callback();
    }
  };

  StorageArea.prototype.get = function(items, callback) {
    if (typeof items === 'function') {
      callback = items;
      items = {};
      for (var i = 0; i < localStorage.length; i++) {
        items[localStorage.key(i)] = null;
      }
    } else if (typeof items === 'string') {
      var tmp = items;
      items = {};
      items[tmp] = null;
    } else if (Object.prototype.toString.call(items) === '[object Array]') {
        var newItems = {};
        items.forEach(function(e) {
            newItems[e] = null;
        });
        items = newItems;
    }
    for (var key in items) {
      var item = localStorage.getItem(key);
      if (item != null) {
        items[key] = JSON.parse(item);
      }
    }
    if (callback) {
      callback(items);
    }
  };

  function StorageChange() {
      this.newValue = null;
      this.oldValue = null;
  }

  StorageChange.prototype = {
  };

  var local = new StorageArea();
  local.QUOTA_BYTES = 5242880;

  var sync = new StorageArea();
  sync.MAX_ITEMS = 512;
  sync.MAX_WRITE_OPERATIONS_PER_HOUR = 1000;
  sync.QUOTA_BYTES_PER_ITEM = 4096;
  sync.MAX_SUSTAINED_WRITE_OPERATIONS_PER_MINUTE = 10;
  sync.QUOTA_BYTES = 102400;


  var exports = module.exports;
  exports.local = local;
  exports.sync = sync;

  var events = require('helpers.events');
  exports.onChanged = {}; // TODO(mmocny)
  exports.onChanged.addListener = events.addListener('onChanged');
  exports.onChanged.fire = events.fire('onChanged');
});

define('helpers.events', function(require, module) {

  var listeners = {};
  module.exports.addListener = function(name) {
    return function(f) {
      if(!listeners[name]) {
        listeners[name] = [f];
      } else {
        listeners[name].push(f);
      }
    };
  };

  module.exports.fire = function(name) {
    return function() {
      for (var i = 0; i < listeners[name].length; i++) {
        listeners[name][i]();
      }
    };
  };
});


// Concluding code for the APIs, with the implementation of require and inclusion of main.
// Load the module 'chrome' to kick things off.

  function exportSymbol(name, object) {
    var parts = name.split('.');
    var cur = window;
    for (var i = 0, part; part = parts[i++];) {
      if (i == parts.length) {
        cur[part] = object;
      } else if (cur[part]) {
        cur = cur[part];
      } else {
        cur = cur[part] = {};
      }
    }
  }
  // Create the root symbol. This will clobber Chrome's native symbol if applicable.
  chrome = {};
  for (var key in modules) {
    if (key.indexOf('chrome.') == 0) {
      exportSymbol(key, require(key));
    }
  }

// Close the wrapping function and call it.
})();
