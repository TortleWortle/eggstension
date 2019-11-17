import adapter from 'webrtc-adapter';
import { Actions, States, Operations } from './constants.js';

const configuration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' }
  ]
};
const apiHost = process.env.API_HOST;
const wsHost = process.env.WS_HOST;

let ws;
let secret;
let rtc = {};
let stream;
let timeout;
let url;

function sendWSMessage(obj) {
  ws.send(JSON.stringify(obj));
}

function sendPopupMessage(port, obj) {
  port.postMessage(JSON.stringify(obj));
}

function onmsg(evt) {
  const e = JSON.parse(evt.data);

  switch (e.op) {
    case Operations.identify:
      claimOwnerShip();
      break;
    case Operations.createOffer:
      createRtcConnection(e.data.recipient, JSON.parse(e.data.offer));
      break;
    case Operations.ready:
      break;
    case Operations.iceCandidate:
      rtc[e.data.recipient] && rtc[e.data.recipient].addIceCandidate(JSON.parse(e.data.candidate));
      break;
  }

  console.log(e);
}

async function createRtcConnection(recipient, offer) {
  const conn = new RTCPeerConnection(configuration);
  stream.getTracks().forEach(track => conn.addTrack(track, stream));
  conn.setRemoteDescription(offer);

  const answer = await conn.createAnswer(offer);
  conn.setLocalDescription(answer);

  conn.addEventListener('icecandidate', function (event) {
    console.log("Got ice candidate", event.candidate);
    sendWSMessage({
      op: Operations.iceCandidate,
      candidate: JSON.stringify(event.candidate),
      recipient
    });
  });

  conn.oniceconnectionstatechange = function () {
    if (conn.iceConnectionState == 'disconnected') {
      rtc[recipient] = null;
      console.log("disconnected");
    }
    console.log("ICE state change: " + conn.iceConnectionState);
  }

  conn.onconnectionstatechange = function () {
    console.log("state change: " + conn.connectionState);
  }

  rtc[recipient] = conn;

  sendWSMessage({
    op: Operations.sendAnswer,
    recipient,
    answer: JSON.stringify(answer),
  });
}

function claimOwnerShip() {
  sendWSMessage({
    op: Operations.claimOwnership,
    secret,
  });
}

async function startSocket() {
  const info = await fetch(`${apiHost}/newroom`).then(res => res.json());
  secret = info.secret;

  ws = new WebSocket(`${wsHost}/rooms/${info.id}`);

  ws.onopen = function () {
    console.log("Connection opened")
  }
  ws.onerror = function () {
    console.error("Connection opened")
  }
  ws.onclose = function () {
    console.log("Connection closing")
  }
  ws.onmessage = onmsg;

  timeout = setInterval(() => {
    sendWSMessage({
      op: Operations.heartBeat
    });
  }, 30000);

  url = `${apiHost}/watch/${info.id}`;
  chrome.tabs.create({ url });
}

function sendState(port) {
  sendPopupMessage(port, {
    action: Actions.setState,
    state: stream != null ? States.sharing : States.idle,
    url,
  });
}

chrome.extension.onConnect.addListener(function (port) {
  console.log("Extension Connected .....");
  port.onMessage.addListener(function (msg) {
    const payload = JSON.parse(msg);
    console.log(payload);

    switch (payload.action) {
      case Actions.startShare:
        if (stream) return;
        chrome.tabCapture.capture({
          audio: true,
          video: true,
        }, lstream => {
          stream = lstream;
          window.stream = stream;
          sendState(port);
          startSocket();
        });
        break;

      case Actions.getState:
        sendState(port);
      break;


      case Actions.stopShare:
        if (Object.keys(rtc).length > 0) {
          Object.keys(rtc).forEach(key => {
            if (rtc[key]) rtc[key].close()
          });
          rtc = {};
        }
        if (ws) {
          ws.close();
          ws = null;
        }
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
          stream = null;
        }
        clearTimeout(timeout);
        break;
    }
  });
});
