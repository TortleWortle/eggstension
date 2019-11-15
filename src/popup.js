const port = chrome.extension.connect({
  name: "fibsh_communication_eggh"
});


document.getElementById("start").onclick = startStream
document.getElementById("stop").onclick = stopStream


function startStream() {
  port.postMessage(JSON.stringify({
    action: "START_SHARE"
  }));
}

function stopStream() {
  port.postMessage(JSON.stringify({
    action: "STOP_SHARE"
  }));
}