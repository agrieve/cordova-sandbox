// Copyright (c) 2013 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.
// http://github.com/MobileChromeApps/chrome-cordova
// Built on 2013-02-04


// Copyright (c) 2012 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.
//
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

// Copyright (c) 2012 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

define('chrome.app.runtime', function(require, module) {
  var Event = require('chrome.Event');
  var exports = module.exports;
  exports.onLaunched = new Event('onLaunched');
});

// Copyright (c) 2012 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

define('chrome.app.window', function(require, module) {
  var Event = require('chrome.Event');
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
    setBounds: unsupportedApi('AppWindow.setBounds'),
    onBoundsChanged: new Event('onBoundsChanged'),
    onClosed: new Event('onClosed')
  };
  AppWindow.prototype.getBounds = function() {
    return {
      width: 0,
      height: 0,
      left: 0,
      top: 0
    };
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
      // Don't bother with inline scripts since they aren't evalled on desktop.
      if (script.src) {
        var replacement = doc.createElement('script');
        copyAttributes(script, replacement);
        script.parentNode.replaceChild(replacement, script);
      }
    }
  }

  function rewritePage(pageContent, filePath) {
    var fgBody = mobile.fgWindow.document.body;
    var fgHead = fgBody.previousElementSibling;

    // fgHead.innerHTML causes a DOMException on Android 2.3.
    while (fgHead.lastChild) {
      fgHead.removeChild(fgHead.lastChild);
    }

    var startIndex = pageContent.search(/<html([\s\S]*?)>/i);
    if (startIndex != -1) {
      startIndex += RegExp.lastMatch.length;
      // Copy over the attributes of the <html> tag.
      applyAttributes(RegExp.lastParen, fgBody.parentNode);
    } else {
      startIndex = 0;
    }

    function afterBase() {
      fgHead.insertAdjacentHTML('beforeend', headHtml);
      evalScripts(fgHead);

      mobile.eventIframe.insertAdjacentHTML('afterend', pageContent);
      evalScripts(fgBody);
    }
    // Put everything before the body tag in the head.
    var endIndex = pageContent.search(/<body([\s\S]*?)>/i);
    if (endIndex == -1) {
      mobile.eventIframe.insertAdjacentHTML('afterend', 'Load error: Page is missing body tag.');
    } else {
      applyAttributes(RegExp.lastParen, fgBody);

      // Don't bother removing the <body>, </body>, </html>. The browser's sanitizer removes them for us.
      var headHtml = pageContent.slice(startIndex, endIndex);
      pageContent = pageContent.slice(endIndex);

      fgHead.insertAdjacentHTML('beforeend', '<link rel="stylesheet" href="chromeappstyles.css">');
      var baseUrl = filePath.replace(/\/.*?$/, '');
      if (baseUrl != filePath) {
        fgHead.insertAdjacentHTML('beforeend', '<base href="' + encodeURIComponent(baseUrl) + '/">\n');
        // setTimeout required for <base> to take effect for <link> elements (browser bug).
        window.setTimeout(afterBase, 0);
      } else {
        afterBase();
      }
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
        rewritePage(pageContent, filePath);
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

// Copyright (c) 2012 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

define('chrome.Event', function(require, module) {
  var Event = function(opt_eventName) {
    this.name = opt_eventName || '';
    this.listeners = [];
  };

  // Deliberately not filtering functions that are already added.
  // I tested on desktop and it will call your callback once for each addListener.
  Event.prototype.addListener = function(cb) {
    this.listeners.push(cb);
  };

  Event.prototype.findListener_ = function(cb) {
    for(var i = 0; i < this.listeners.length; i++) {
      if (this.listeners[i] == cb) {
        return i;
      }
    }

    return -1;
  };

  Event.prototype.removeListener = function(cb) {
    var index = this.findListener_(cb);
    if (index >= 0) {
      this.listeners.splice(index, 1);
    }
  };

  Event.prototype.hasListener = function(cb) {
    return this.findListener_(cb) >= 0;
  };

  Event.prototype.hasListeners = function() {
    return this.listeners.length > 0;
  };

  Event.prototype.fire = function() {
    for (var i = 0; i < this.listeners.length; i++) {
      this.listeners[i]();
    }
  };

  // Stubs since we don't support Rules.
  Event.prototype.addRules = function() { };
  Event.prototype.getRules = function() { };
  Event.prototype.removeRules = function() { };

  module.exports = Event;
});

// Copyright (c) 2012 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

define('chrome.fileSystem', function(require, module) {
  var exports = module.exports;
  var FileEntry = cordova.require('cordova/plugin/FileEntry');

  exports.getDisplayPath = function(fileEntry, callback) {
    callback(fileEntry.fullPath);
  };

  exports.getWritableEntry = function(fileEntry, callback) {
    callback(null);
  };

  exports.isWritableEntry = function(fileEntry, callback) {
    callback(false);
  };

  exports.chooseEntry = function(options, callback) {
    // Ensure that the type is either unspecified or specified as 'openFile', as nothing else is supported.
    if (options.type && options.type != 'openFile') {
      // TODO(maxw): Determine a "more correct" way to fail here.
      return;
    }

    // Determine the media type.
    var mediaType = determineMediaType(options.accepts, options.acceptsAllTypes);

    // Create the callback for getPicture.
    // It creates a file entry and passes it to the chooseEntry callback.
    var onPictureReceived = function(nativeUri) {
      var fileEntry = new FileEntry('image.png', nativeUri);
      callback(fileEntry);
    };

    // Prepare the options for getting the picture.
    var getPictureOptions = { destinationType: navigator.camera.DestinationType.NATIVE_URI,
                              sourceType: navigator.camera.PictureSourceType.PHOTOLIBRARY,
                              mediaType: mediaType };

    // Get a picture.
    navigator.camera.getPicture(onPictureReceived, null, getPictureOptions);
  };

  function determineMediaType(acceptOptions, acceptsAllTypes) {
    if (acceptsAllTypes) {
      return navigator.camera.MediaType.ALLMEDIA;
    }

    var imageMimeTypeRegex = /^image\//;
    var videoMimeTypeRegex = /^video\//;
    var imageExtensionRegex = /^(?:jpg|png)$/;
    var videoExtensionRegex = /^mov$/;
    var imagesAllowed = false;
    var videosAllowed = false;

    // Iterate through all accept options.
    // If we see anything image related, allow images.  If we see anything video related, allow videos.
    if (acceptOptions) {
      for (var i = 0; i < acceptOptions.length; i++) {
        if (acceptOptions[i].mimeTypes) {
          for (var j = 0; j < acceptOptions[i].mimeTypes.length; j++) {
            if (imageMimeTypeRegex.test(acceptOptions[i].mimeTypes[j])) {
              imagesAllowed = true;
            } else if (videoMimeTypeRegex.test(acceptOptions[i].mimeTypes[j])) {
              videosAllowed = true;
            }
          }
        }
        if (acceptOptions[i].extensions) {
          for (var k = 0; k < acceptOptions[i].extensions.length; k++) {
            if (imageExtensionRegex.test(acceptOptions[i].extensions[k])) {
              imagesAllowed = true;
            } else if (videoExtensionRegex.test(acceptOptions[i].extensions[k])) {
              videosAllowed = true;
            }
          }
        }
      }
    }

    if (imagesAllowed && !videosAllowed) {
      return navigator.camera.MediaType.PICTURE;
    } else if (!imagesAllowed && videosAllowed) {
      return navigator.camera.MediaType.VIDEO;
    }

    return navigator.camera.MediaType.ALLMEDIA;
  }
});

// Copyright (c) 2012 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

define('chrome.mobile.impl', function(require, module) {
  var chrome = window.chrome;
  var exports = module.exports;

  exports.fgWindow = window;
  exports.bgWindow = null;
  exports.eventIframe = null;

  function createBgChrome() {
    return {
      __proto__: chrome,
      app: {
        __proto__: chrome.app,
        window: {
          __proto__: chrome.app.window,
          current: function() { return null; }
        }
      }
    };
  }

  exports.init = function() {
    // Self-destruct so that code in here can be GC'ed.
    exports.init = null;
    var iframe = document.createElement('iframe');
    iframe.src = 'chromebgpage.html';
    iframe.style.display = 'none';
    exports.eventIframe = iframe;
    document.body.appendChild(iframe);
  };

  exports.bgInit = function(bgWnd) {
    // Self-destruct so that code in here can be GC'ed.
    exports.bgInit = null;
    exports.bgWindow = bgWnd;
    bgWnd.chrome = createBgChrome();
    bgWnd.cordova = cordova;
    exports.fgWindow.opener = exports.bgWindow;

    function onLoad() {
      bgWnd.removeEventListener('load', onLoad, false);
      setTimeout(function() {
        chrome.app.runtime.onLaunched.fire();
      }, 0);
    }
    bgWnd.addEventListener('load', onLoad, false);

    var manifestJson = chrome.runtime.getManifest();
    var scripts = manifestJson.app.background.scripts;
    var toWrite = '';
    for (var i = 0, src; src = scripts[i]; ++i) {
      toWrite += '<script src="' + encodeURI(src) + '"></sc' + 'ript>\n';
    }
    bgWnd.document.write(toWrite);
  };
});

// Copyright (c) 2012 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

define('chrome.runtime', function(require, module) {
  var argscheck = cordova.require('cordova/argscheck');
  var Event = require('chrome.Event');
  var stubs = require('helpers.stubs');
  var mobile = require('chrome.mobile.impl');
  var exports = module.exports;
  var manifestJson = null;

  exports.onSuspend = new Event('onSuspend');
  exports.onInstalled = new Event('onInstalled');
  exports.onStartup = new Event('onStartup');
  exports.onSuspendCanceled = new Event('onSuspendCanceled');
  exports.onUpdateAvailable = new Event('onUpdateAvailable');

  var original_addListener = exports.onSuspend.addListener;

  // Uses a trampoline to bind the Cordova pause event on the first call.
  exports.onSuspend.addListener = function(f) {
    window.document.addEventListener('pause', exports.onSuspend.fire, false);
    exports.onSuspend.addListener = original_addListener;
    exports.onSuspend.addListener(f);
  };

  exports.getManifest = function() {
    if (!manifestJson) {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', 'manifest.json', false /* sync */);
      xhr.send(null);
      manifestJson = JSON.parse(xhr.responseText);
    }
    return manifestJson;
  };

  exports.getBackgroundPage = function(callback) {
    argscheck.checkArgs('f', 'chrome.runtime.getBackgroundPage', arguments);
    setTimeout(function() {
      callback(mobile.bgWindow);
    }, 0);
  };

  exports.getURL = function(subResource) {
    argscheck.checkArgs('s', 'chrome.runtime.getURL', arguments);
    if (subResource.charAt(0) == '/') {
      subResource = subResource.slice(1);
    }
    var prefix = location.href.replace(/[^\/]*$/, '');
    return prefix + subResource;
  };

  exports.reload = function() {
    location.reload();
  };

  stubs.createStub(exports, 'id', '{appId}');
  stubs.createStub(exports, 'requestUpdateCheck', function(){});
});

// Copyright (c) 2012 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

define('chrome.socket', function(require, module) {

var exports = module.exports;

exports.create = function(socketMode, stuff, callback) {
    callback = callback || stuff;
    var win = callback && function(socketId) {
        var socketInfo = {
            socketId: socketId
        };
        callback(socketInfo);
    };
    cordova.exec(win, null, 'ChromeSocket', 'create', [socketMode]);
};

exports.connect = function(socketId, address, port, callback) {
    cordova.exec(callback, null, 'ChromeSocket', 'connect', [socketId, address, port]);
};

exports.bind = function(socketId, address, port, callback) {
  console.warn('chrome.socket.bind not implemented yet');
  callback(0);
};

exports.listen = function(socketId, address, port, backlog, callback) {
    if (typeof backlog == 'function') {
        callback = backlog;
        backlog = 0;
    }
    cordova.exec(callback, null, 'ChromeSocket', 'listen', [socketId, address, port, backlog]);
};

exports.accept = function(socketId, callback) {
    var win = callback && function(socketId) {
        var acceptInfo = {
            resultCode: 0,
            socketId: socketId
        };
        callback(acceptInfo);
    };
    cordova.exec(win, null, 'ChromeSocket', 'accept', [socketId]);
};

exports.write = function(socketId, data, callback) {
    var type = Object.prototype.toString.call(data).slice(8, -1);
    if (type != 'ArrayBuffer') {
        throw new Error('chrome.socket.write - data is not an ArrayBuffer! (Got: ' + type + ')');
    }

    var win = callback && function(bytesWritten) {
        var writeInfo = {
            bytesWritten: bytesWritten
        };
        callback(writeInfo);
    };
    cordova.exec(win, null, 'ChromeSocket', 'write', [socketId, data]);
};

exports.read = function(socketId, bufferSize, callback) {
    if (typeof bufferSize == 'function') {
        callback = bufferSize;
        bufferSize = 0;
    }
    var win = callback && function(data) {
        var readInfo = {
            resultCode: data.byteLength || 1,
            data: data
        };
        callback(readInfo);
    };
    var fail = callback && function() {
        var readInfo = { resultCode: 0 };
        callback(readInfo);
    };
    cordova.exec(win, fail, 'ChromeSocket', 'read', [socketId, bufferSize]);
};

exports.sendTo = function(socketId, data, address, port, callback) {
    var type = Object.prototype.toString.call(data).slice(8, -1);
    if (type != 'ArrayBuffer') {
        throw new Error('chrome.socket.write - data is not an ArrayBuffer! (Got: ' + type + ')');
    }

    var win = callback && function(bytesWritten) {
        var writeInfo = {
            bytesWritten: bytesWritten
        };
        callback(writeInfo);
    };
    cordova.exec(win, null, 'ChromeSocket', 'sendTo', [{ socketId: socketId, address: address, port: port }, data]);
};

// TODO: Raw functionality is almost the exact same, so reusing implementation for now.  This will need to change though.
exports.recvFrom = exports.read;

exports.disconnect = function(socketId) {
    cordova.exec(null, null, 'ChromeSocket', 'disconnect', [socketId]);
};

exports.destroy = function(socketId) {
    cordova.exec(null, null, 'ChromeSocket', 'destroy', [socketId]);
};

exports.getNetworkList = function(callback) {
  console.warn('chrome.socket.getNetworkList not implemented yet');
  callback(null);
};

});

// Copyright (c) 2012 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

define('chrome.storage', function(require, module) {

  function jsonReplacer(key) {
    // Don't use the value passed in since it has already gone through toJSON().
    var value = this[key];
    // Refer to:
    // chrome/src/content/renderer/v8_value_converter_impl.cc&l=165
    if (value && (typeof value == 'object' || typeof value == 'function')) {
      var typeName = Object.prototype.toString.call(value).slice(8, -1);
      if (typeName != 'Array' && typeName != 'Object') {
        value = {};
      }
    }
    return value;
  }

  function StorageArea(namespaceChar) {
    this._namespace = '_%_' + namespaceChar;
  }

  StorageArea.prototype.getBytesInUse = unsupportedApi('StorageArea.getBytesInUse');

  StorageArea.prototype.clear = function() {
    var toRemove = [];
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k.slice(0, 4) == this._namespace) {
        toRemove.push(k);
      }
    }
    toRemove.forEach(localStorage.removeItem, localStorage);
  };

  StorageArea.prototype.set = function(items) {
    for (var key in items) {
      if (items.hasOwnProperty(key)) {
        if (typeof items[key] != 'undefined') {
          var value = JSON.stringify(items[key], jsonReplacer);
          localStorage.setItem(this._namespace + key, value);
        }
      }
    }
  };

  StorageArea.prototype.remove = function(keys) {
    if (typeof keys == 'string') {
      keys = [keys];
    }
    for (var i = 0; i < keys.length; ++i) {
      localStorage.removeItem(this._namespace + keys[i]);
    }
  };

  StorageArea.prototype.get = function(items, callback) {
    var ret = {};

    if (typeof items == 'function') {
      callback = items;
      items = null;
    }
    if (typeof callback != 'function') {
      throw 'callback must be a function';
    }

    var namespace = this._namespace;
    function getLocalStorageValuesForKeys(keys) {
      var ret = {};
      keys.forEach(function(key) {
        var item = localStorage.getItem(namespace + key);
        if (item !== null) {
          ret[key] = JSON.parse(item);
        }
      });
      return ret;
    }


    if (items == null) {
      var keys = [];
      for (var i = 0; i < localStorage.length; i++) {
        keys.push(localStorage.key(i).slice(4));
      }
      ret = getLocalStorageValuesForKeys(keys);
    } else if (typeof items == 'string') {
      ret = getLocalStorageValuesForKeys([items]);
    } else if (Object.prototype.toString.call(items).slice(8, -1) == 'Array') {
      ret = getLocalStorageValuesForKeys(items);
    } else {
      ret = items; // assign defaults
      var o = getLocalStorageValuesForKeys(Object.keys(items));
      Object.keys(o).forEach(function(key) {
          ret[key] = o[key];
      });
    }
    callback(ret);
  };
/*
  function StorageChange(oldValue, newValue) {
    this.oldValue = oldValue;
    this.newValue = newValue;
  }
*/
  var local = new StorageArea('l');
  local.QUOTA_BYTES = 5242880;

  var sync = new StorageArea('s');
  sync.MAX_ITEMS = 512;
  sync.MAX_WRITE_OPERATIONS_PER_HOUR = 1000;
  sync.QUOTA_BYTES_PER_ITEM = 4096;
  sync.MAX_SUSTAINED_WRITE_OPERATIONS_PER_MINUTE = 10;
  sync.QUOTA_BYTES = 102400;

  var exports = module.exports;
  exports.local = local;
  exports.sync = sync;

  // TODO(mmocny): Hook up this event so it actually gets called(?)
  var Event = require('chrome.Event');
  exports.onChanged = new Event('onChanged');
  //chrome.storage.onChanged.addListener(function(object changes, string areaName) {...});

});

// Copyright (c) 2012 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

define('helpers.stubs', function(require, module) {
  var exports = module.exports;
  exports.createStub = function(obj, propName, value) {
    obj.__defineGetter__(propName, function() {
      console.warn('Access made to stub: ' + obj.__namespace__ + '.' + propName);
      return value;
    });
  };
});

// Copyright (c) 2012 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.
//
// Concluding code for the APIs, with the implementation of require and inclusion of main.
// Load the module 'chrome' to kick things off.

  function exportSymbol(name, object) {
    object.__namespace__ = name;
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
