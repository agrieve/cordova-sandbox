
function throttleDecorator(obj, func, delay) {
  var timerId = null;
  function unthrottled() {
    window.clearTimeout(timerId)
    timerId = null;
    func.apply(obj, arguments);
  }
  function throttled() {
    timerId = timerId || window.setTimeout(unthrottled, delay);
  }
  return [throttled, unthrottled];
}

function maybeCall(func) {
  if (func) {
    var args = Array.prototype.slice.call(arguments, 1);
    func.apply(this, args);
  }
}


var DATA_PREFIX = 'A5jwiqb';


function DataModel(fileName) {
  this.fileName = fileName;
  this._fileNameSaved = !!fileName;
  this.onsave = null;
  this.autoLockTimeout = 30;
  this.reset();

  var pair = throttleDecorator(this, DataModel.prototype.save, 1000);
  this.autoSave = pair[0];
  this.save = pair[1];
}

DataModel.prototype.reset = function() {
  this.lastSaved = null;
  this.password = null;
  this.unencryptedData = '';
};

DataModel.prototype.save = function(callback) {
  var data = {};
  if (!this._fileNameSaved) {
    data['master'] = this.fileName;
    this._fileNameSaved = true;
  }
  data['autoLockTimeout-' + this.fileName] = this.autoLockTimeout;
  if (this.password) {
    var encrypted = CryptoJS.AES.encrypt(DATA_PREFIX + this.unencryptedData, this.password);

    this.lastSaved = new Date;
    data['payload-' + this.fileName] = encrypted.toString();
    data['time-' + this.fileName] = this.lastSaved.getTime();
  }
  var me = this;
  chrome.storage.sync.set(data, function() {
    maybeCall(callback);
    maybeCall(me.onsave);
  });
};

DataModel.prototype.load = function(callback, failBack) {
  var me = this;
  var storageKey = 'payload-' + this.fileName;
  var timeKey = 'time-' + this.fileName;
  var autoLockTimeoutKey = 'autoLockTimeout-' + this.fileName;
  var encrypted = chrome.storage.sync.get([storageKey, timeKey, autoLockTimeoutKey], function(items) {
    var decrypted = '';
    if (me.password) {
      try {
        decrypted = CryptoJS.AES.decrypt(items[storageKey], me.password).toString(CryptoJS.enc.Utf8);
      } catch(e) {
      }
    }
    me.autoLockTimeout = items[autoLockTimeoutKey];
    if (decrypted.indexOf(DATA_PREFIX) == 0) {
      me.unencryptedData = decrypted.slice(DATA_PREFIX.length);
      me.lastSaved = new Date(items[timeKey]);
      callback();
    } else {
      failBack();
    }
  });
};
