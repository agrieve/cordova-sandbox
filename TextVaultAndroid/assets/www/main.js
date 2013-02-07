
function $$(s) {
  var ret = document.querySelectorAll(s);
  if (!ret || !ret.length) {
    throw Error('Bad query selector: ' + s);
  }
  return ret;
}

function $(s) {
  return $$(s)[0];
}

function setVisible(elem, value) {
  elem.style.display = value ? '' : 'none';
}

/////////
var HAS_PHYSICAL_KEYBOARD = !window.cordova;

var newUserViewElem = $('#new-user');
var newUserFormElem = $('#new-user form');
var newUserInputElem = $('#new-user input')
var newUserFormElem = $('#new-user form');
var newUserSubmitElem = $('#new-user input[type=submit]');
var existingUserViewElem = $('#existing-user');
var existingUserFormElem = $('#existing-user form');
var existingUserLockElem = $('.lock-img');
var existingUserInputElem = $('#existing-user input')
var existingUserSubmitElem = $('#existing-user input[type=submit]');
var editViewElem = $('#edit-view');
var editViewLockButtonElem = $('#btn-lock');
var editViewTextAreaElem = $('#edit-view textarea');
var editViewGearElem = $('.gear-img');
var editViewLastSavedElem = $('#last-saved');
var editViewCharCountElem = $('#char-count');
var flipContainerElem = $('#flip-container');
var settingsAutoLockElem = $('#autolock-select');
var settingsBackElem = $('#btn-close');
var settingsChangePasswordSectionElem = $('#change-password-section');
var settingsChangePasswordBtnElem = $('#change-password-btn');
var settingsExistingPasswordElem = $$('#settings-view .password-input')[0];
var settingsNewPasswordElem = $$('#settings-view .password-input')[1];
var curUiState = 0;
var autoLockTimerId = 0;
var wnd = chrome.app.window.current();
var unlockedWindowSize = wnd.getBounds();

var UiState = {
  INIT: 0,
  NEW: 1,
  EXISTING: 2,
  EDITING: 3,
  SETTINGS: 4
};

function isLockScreen(uiState) {
  return uiState == UiState.EXISTING || uiState == UiState.NEW;
}

function updateUiState(forceState) {
  // Don't update any state if the window has been closed.
  if (!window) {
    return;
  }
  var firstTimeUser = !dataModel.fileName;
  var hasPassword = !firstTimeUser && !!dataModel.password;
  var newState = firstTimeUser ? UiState.NEW :
                 hasPassword ? UiState.EDITING :
                 UiState.EXISTING;
  // Stay in settings until they leave via forceState.
  if (newState == UiState.EDITING && curUiState == UiState.SETTINGS) {
    newState = UiState.SETTINGS;
  }
  // Ignore events that are passed as params.
  if (typeof forceState == 'number') {
    newState = forceState;
  }
  if (curUiState != newState) {
    setVisible(existingUserLockElem, newState == UiState.EXISTING);
    if (newState == UiState.EDITING && curUiState == UiState.EXISTING) {
      existingUserLockElem.classList.add('correct-pass-anim');
      setVisible(existingUserLockElem, true);
    } else if (newState == UiState.EXISTING && curUiState == UiState.EDITING) {
      existingUserLockElem.classList.add('lock-anim');
    } else if (newState == UiState.EXISTING && curUiState == UiState.INIT) {
      existingUserLockElem.classList.add('start-up-anim');
    }
    if (newState == UiState.EDITING && isLockScreen(curUiState)) {
      resizeWindow(unlockedWindowSize.width, unlockedWindowSize.height);
    } else if (isLockScreen(newState)) {
      resizeWindow(300, 400);
    }

    if (newState == UiState.SETTINGS) {
      flipContainerElem.classList.add('flipped');
      editViewGearElem.classList.add('gear-anim');
    } else {
      flipContainerElem.classList.remove('flipped');
      editViewGearElem.classList.remove('gear-anim');
    }
    setVisible(newUserViewElem, newState == UiState.NEW);
    setVisible(existingUserViewElem, newState == UiState.EXISTING);
    setVisible(editViewElem, newState == UiState.EDITING || newState == UiState.SETTINGS);
    newUserInputElem.value = '';
    existingUserInputElem.value = '';
    settingsAutoLockElem.value = dataModel.autoLockTimeout;
    // Focus the default field.
    if (HAS_PHYSICAL_KEYBOARD) {
      switch (newState) {
        case UiState.NEW:
          newUserInputElem.focus();
          break;
        case UiState.EXISTING:
          existingUserInputElem.focus();
          break;
        case UiState.EDITING:
          editViewTextAreaElem.focus();
          break;
        case UiState.SETTINGS:
          settingsBackElem.focus();
          break;
      }
    }
    curUiState = newState;
  }
  if (curUiState == UiState.EDITING) {
    editViewTextAreaElem.value = dataModel.unencryptedData;
    editViewLastSavedElem.innerText = dataModel.lastSaved.toString().replace(/ GMT.*/, '');
    editViewCharCountElem.innerText = dataModel.unencryptedData.length;
  }
  if (curUiState == UiState.SETTINGS) {
    var curPassword = settingsExistingPasswordElem.value;
    settingsExistingPasswordElem.classList.remove('password-input-correct');
    settingsExistingPasswordElem.classList.remove('password-input-wrong');
    if (curPassword == dataModel.password) {
      settingsExistingPasswordElem.classList.add('password-input-correct');
    } else if (curPassword) {
      settingsExistingPasswordElem.classList.add('password-input-wrong');
    }
    settingsChangePasswordBtnElem.disabled = !(curPassword == dataModel.password && settingsNewPasswordElem.value);
  }
}

function flushChanges(autoSave, resetAfter, e) {
  if (dataModel.unencryptedData != editViewTextAreaElem) {
    console.log('flush from event: ' + (e.type || e));
    dataModel.unencryptedData = editViewTextAreaElem.value;
    updateUiState();
    if (autoSave) {
      dataModel.autoSave();
    } else {
      dataModel.save(function() {
        if (resetAfter) {
          dataModel.reset();
        }
      });
    }
  }
}

function resizeWindow(newWidth, newHeight) {
  var startBounds = wnd.getBounds();
  var wDiff = newWidth - startBounds.width;
  var hDiff = newHeight - startBounds.height;
  wnd.setBounds({
    left: Math.floor(Math.min(screen.width - newWidth, Math.max(0, startBounds.left - wDiff / 2))),
    top: Math.min(screen.height - newHeight, Math.max(0, startBounds.top - hDiff)),
    width: newWidth,
    height: newHeight
  });
}

function resetAutoLock() {
  clearTimeout(autoLockTimerId);
  document.body.classList.remove('auto-lock-fade');
  if (dataModel.autoLockTimeout > 0) {
    autoLockTimerId = setTimeout(onAutoLockBegin, dataModel.autoLockTimeout * 1000);
  }
}

function onAutoLockBegin() {
  document.body.classList.add('auto-lock-fade');
}

function onBodyTransitionEnd(e) {
  if (e.target == document.body) {
    console.log('Auto-lock kicked in');
    window.close();
  }
}

function onExistingPasswordSubmit(e) {
  e.preventDefault();
  var password = existingUserInputElem.value;
  if (!password) {
    return;
  }
  dataModel.password = password;
  dataModel.load(function() {
    existingUserInputElem.blur();
    updateUiState();
  }, function() {
    setTimeout(function() {
      existingUserLockElem.classList.add('wrong-pass-anim');
      existingUserInputElem.select();
    }, 0);
    existingUserInputElem.focus();
  });
}

function onNewPasswordSubmit(e) {
  e.preventDefault();
  newUserInputElem.blur();
  var password = newUserInputElem.value;
  if (!password) {
    return;
  }
  dataModel.fileName = 'file1';
  dataModel.password = password;
  dataModel.save();
}

function onChangeAutoLock() {
  dataModel.autoLockTimeout = +settingsAutoLockElem.value;
  dataModel.save();
  resetAutoLock();
}

function onChangePassword() {
  dataModel.password = settingsNewPasswordElem.value;
  dataModel.save();
  settingsNewPasswordElem.value = settingsExistingPasswordElem.value = '';
  settingsChangePasswordBtnElem.disabled = true;
  settingsChangePasswordSectionElem.classList.add('change-password-anim');
}

function onBoundsChanged() {
  if (!isLockScreen(curUiState)) {
    unlockedWindowSize = wnd.getBounds();
  }
}

function onStorageChanged(changes, areaName) {
  // TODO
}

function registerEvents() {
  newUserFormElem.onsubmit = onNewPasswordSubmit;
  newUserInputElem.oninput = function() {
    newUserSubmitElem.disabled = !newUserInputElem.value;
  };

  existingUserFormElem.onsubmit = onExistingPasswordSubmit;
  existingUserInputElem.oninput = function() {
    existingUserSubmitElem.disabled = !existingUserInputElem.value;
  };

  editViewTextAreaElem.oninput = flushChanges.bind(null, true, false);
  editViewTextAreaElem.onblur = flushChanges.bind(null, false, false);
  editViewLockButtonElem.onclick = flushChanges.bind(null, false, true);
  editViewGearElem.onclick = updateUiState.bind(null, UiState.SETTINGS);
  editViewGearElem.onkeypress = function(e) {
    (e.which == 13) && editViewGearElem.onclick();
  };

  settingsBackElem.onclick = updateUiState.bind(null, UiState.EDITING);
  settingsAutoLockElem.onchange = onChangeAutoLock;
  settingsExistingPasswordElem.oninput = updateUiState;
  settingsNewPasswordElem.oninput = updateUiState;
  settingsChangePasswordBtnElem.onclick = onChangePassword;
  settingsChangePasswordSectionElem.addEventListener('webkitAnimationEnd', function() {
    settingsChangePasswordSectionElem.classList.remove('change-password-anim');
  }, false);


  existingUserLockElem.addEventListener('webkitAnimationEnd', function() {
    if (curUiState == UiState.EDITING) {
      setVisible(existingUserLockElem, false);
    }
    window.setTimeout(function() {
      existingUserLockElem.classList.remove('wrong-pass-anim');
      existingUserLockElem.classList.remove('correct-pass-anim');
      existingUserLockElem.classList.remove('start-up-anim');
      existingUserLockElem.classList.remove('lock-anim');
    }, 0);
  }, false);

  document.addEventListener('touchstart', resetAutoLock, false);
  document.addEventListener('mousedown', resetAutoLock, false);
  document.addEventListener('keydown', resetAutoLock, false);

  wnd.onClosed.addListener(flushChanges.bind(null, false, true, 'closed'));
  wnd.onBoundsChanged.addListener(onBoundsChanged);
  chrome.storage.onChanged.addListener(onStorageChanged);
  dataModel.onsave = updateUiState;
  document.body.addEventListener('webkitTransitionEnd', onBodyTransitionEnd, false);

  if (window.cordova) {
    new FastClick(document.body);
  }
}

function init() {
  if (chrome.mobile) {
    document.body.classList.add('ios');
  }
  registerEvents();
  updateUiState();
  resetAutoLock();
}

init();
