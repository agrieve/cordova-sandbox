
var wnd = null;
var dataModel = null;

function onWindowCreated(w) {
  wnd = w;
  // Always log to the background page's console.
  wnd.contentWindow.console = console;
  wnd.contentWindow.dataModel = dataModel;

  // You can't re-show a window after it's been closed.
  wnd.onClosed.addListener(function() {
    wnd = null;
  });

  wnd.focus();
}

function createWindow() {
  if (wnd) {
    wnd.show();
  } else {
    // TODO: File a bug about calling onWindowCreated before showing the window.
    chrome.app.window.create('main.html', {width: 300, height: 400, id: 'a'}, onWindowCreated);
  }
}

/**
 * Listens for the app launching then creates the window
 */
chrome.app.runtime.onLaunched.addListener(function() {
  if (!dataModel) {
    chrome.storage.sync.get('master', function(items) {
      dataModel = new DataModel(items.master || '');
      // Loads the auto-lock values.
      dataModel.load(createWindow, createWindow);
    });
  } else {
    createWindow();
  }
});
