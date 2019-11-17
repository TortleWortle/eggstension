import { Actions, States } from './constants.js';

const port = chrome.extension.connect({
  name: "fibsh_communication_eggh"
});

function sendAction(action) {
  port.postMessage(JSON.stringify({
    action
  }));
}

// handle messages
port.onMessage.addListener(function(msg) {
  const payload = JSON.parse(msg);
  switch (payload.action) {
    case Actions.setState:
      if (payload.state == States.sharing)
      {
        document.body.classList.add('sharing');
        document.getElementById('link').value = payload.url;
        document.getElementById('link_hidden').value = payload.url;
      }
      else
        document.body.classList.remove('sharing');
      break;
  }
});

// get current state from background
sendAction(Actions.getState);

// register event listeners
document.getElementById("start").addEventListener('click', () => {
  document.body.classList.add('sharing');
  sendAction(Actions.startShare);
});
document.getElementById("stop").addEventListener('click', () => {
  document.body.classList.remove('sharing');
  sendAction(Actions.stopShare);
});

// copy link
const linkHidden = document.getElementById('link_hidden');
document.getElementById("copy").addEventListener('click', function () {
  linkHidden.select();
  document.execCommand("copy");
  this.innerHTML = "Copied!";
});
