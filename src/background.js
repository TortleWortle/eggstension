import adapter from 'webrtc-adapter';

const configuration = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

const host = "eggh.realmofthemadfibsh.com"


let ws;
let secret;
let id;
let rtc = {};
let stream
let timeout

function onmsg(evt) {
  const e = JSON.parse(evt.data);

  switch (e.op) {
    case "IDENTIFY":
      id = e.data.id
      claimOwnerShip()
      break
    case "CREATE_OFFER":
      createRtcConnection(e.data.recipient, JSON.parse(e.data.offer));
      break
    case "READY":
      // rtc[e.data.recipient].addStream(stream)
      break;
    case "ICE_CANDIDATE":
      rtc[e.data.recipient] && rtc[e.data.recipient].addIceCandidate(JSON.parse(e.data.candidate))
      break
  }

  console.log(e)
}

async function createRtcConnection(recipient, offer) {
  const conn = new RTCPeerConnection(configuration)
  stream.getTracks().forEach(track => conn.addTrack(track, stream))
  conn.setRemoteDescription(offer)
  const answer = await conn.createAnswer(offer)
  conn.setLocalDescription(answer)

  conn.addEventListener('icecandidate', function (event) {
    console.log("Got ice candidate", JSON.parse(JSON.stringify(event.candidate)))
    ws.send(JSON.stringify({
      op: "ICE_CANDIDATE",
      candidate: JSON.stringify(event.candidate),
      recipient
    }))
  })

  conn.oniceconnectionstatechange = function () {
    if (conn.iceConnectionState == 'disconnected') {
      rtc[recipient] = null
      console.log("disconnected")
    }
  }


  rtc[recipient] = conn

  ws.send(JSON.stringify({
    op: "SEND_ANSWER",
    recipient,
    answer: JSON.stringify(answer),
  }))
}

function claimOwnerShip() {
  ws.send(JSON.stringify({
    op: "CLAIM_OWNERSHIP",
    secret,
  }))
}

async function startSocket() {
  const info = await fetch(`http://${host}/newroom`).then(res => res.json())
  secret = info.secret;

  ws = new WebSocket(`wss://${host}/rooms/${info.id}`)

  ws.onopen = function () {
    console.log("Connection opened")
  }
  ws.onerror = function () {
    console.error("Connection opened")
  }
  ws.onclose = function () {
    console.log("Connection closing")
  }
  ws.onmessage = onmsg

  timeout = setInterval(() => {
    ws.send(JSON.stringify({
      op: "HEARTBEAT"
    }))
  }, 30000)

  chrome.tabs.create({ url: `http://${host}/watch/${info.id}` });
}



chrome.extension.onConnect.addListener(function (port) {
  console.log("Extension Connected .....");
  port.onMessage.addListener(function (msg) {
    const payload = JSON.parse(msg)
    console.log(payload);

    switch (payload.action) {
      case 'START_SHARE':
        if (stream) return
        chrome.tabCapture.capture({
          audio: true,
          video: true,
        }, lstream => {
          stream = lstream
          window.stream = stream
          startSocket()
        })
        break

      case 'STOP_SHARE':
        if (Object.keys(rtc).length > 0) {
          Object.keys(rtc).forEach(key => {
            if (rtc[key]) rtc[key].close()
          })
          rtc = {}
        }
        if (ws) {
          ws.close()
          ws = null
        }
        if (stream) {
          stream.getTracks().forEach(track => track.stop())
          stream = null
        }
        clearTimeout(timeout)
        break
    }
  });
})
