let socket = io();
let remoteConnectBtn = document.getElementById("connectRemoteConfig");
let localConnectBtn = document.getElementById("connectLocalConfig");
let remoteConfigText = document.getElementById("remoteConfigText");
let localConfigText = document.getElementById("localConfigText");
let fileUpload = document.getElementById("file-upload");
let sendFileBtn = document.getElementById("sendFile");
let downloadAnchor = document.getElementById("downloadanchor");
let progressbar = document.getElementById("progress");
let progressLabel = document.getElementById("progressLabel");

let localPeer = new RTCPeerConnection({
    iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:stun2.l.google.com:19302" }
    ]
});

let dataChannel;
let receiveBuffer = [];
let receivedSize = 0;
let receivedFile = {};

let iceCandidatesQueue = [];

localConnectBtn.addEventListener("click", async function () {
    dataChannel = localPeer.createDataChannel("dataChannel");
    dataChannel.binaryType = "arraybuffer";
    dataChannel.onmessage = (msg) => onReceiveMessageCallback(msg);
    dataChannel.onopen = () => updateConnectionStatus("Connected to peer.");

    localPeer.onicecandidate = (event) => {
        if (event.candidate) {
            if (localPeer.remoteDescription) {
                socket.emit("ice-candidate", event.candidate);
            } else {
                iceCandidatesQueue.push(event.candidate);
            }
        }
    };

    try {
        const localOffer = await localPeer.createOffer();
        await localPeer.setLocalDescription(localOffer);

        localConfigText.value = JSON.stringify(localPeer.localDescription);

        socket.emit("offer", localPeer.localDescription);
    } catch (error) {
        console.error("Error creating offer:", error);
    }
});

socket.on("offer", async (offer) => {
    try {
        await localPeer.setRemoteDescription(new RTCSessionDescription(offer));

        iceCandidatesQueue.forEach(candidate => {
            localPeer.addIceCandidate(new RTCIceCandidate(candidate));
        });
        iceCandidatesQueue = [];

        const answer = await localPeer.createAnswer();
        await localPeer.setLocalDescription(answer);

        remoteConfigText.value = JSON.stringify(localPeer.localDescription);

        socket.emit("answer", localPeer.localDescription);

        remoteConnectBtn.disabled = true;
    } catch (error) {
        console.error("Error handling offer:", error);
    }
});

socket.on("answer", async (answer) => {
    try {
        await localPeer.setRemoteDescription(new RTCSessionDescription(answer));
    } catch (error) {
        console.error("Error handling answer:", error);
    }
});

socket.on("ice-candidate", (candidate) => {
    try {
        localPeer.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (error) {
        console.error("Error adding ICE candidate:", error);
    }
});

fileUpload.addEventListener("change", function () {
    sendFileBtn.hidden = false;
});

sendFileBtn.addEventListener("click", function () {
    const file = fileUpload.files[0];
    progressbar.max = file.size;
    progressbar.value = 0;
    progressLabel.innerHTML = "0%";

    dataChannel.send(JSON.stringify({
        name: file.name,
        size: file.size,
        type: file.type
    }));

    sendData(file);
});

function sendData(file) {
    let offset = 0;
    let chunkSize = 16384;

    file.arrayBuffer().then((buffer) => {
        const sendChunk = () => {
            while (buffer.byteLength) {
                if (dataChannel.bufferedAmount > dataChannel.bufferedAmountLowThreshold) {
                    dataChannel.onbufferedamountlow = () => {
                        dataChannel.onbufferedamountlow = null;
                        sendChunk();
                    };
                    return;
                }
                const chunk = buffer.slice(0, chunkSize);
                buffer = buffer.slice(chunkSize);
                dataChannel.send(chunk);
                offset += chunkSize;
                progressbar.value = offset >= file.size ? file.size : offset;
                progressLabel.innerHTML = offset >= file.size ? "File sent" : ((offset / file.size) * 100).toFixed(1) + "%";
            }
        };
        sendChunk();
    });
}

localPeer.ondatachannel = (e) => {
    dataChannel = e.channel;
    dataChannel.binaryType = "arraybuffer";
    dataChannel.onmessage = (msg) => onReceiveMessageCallback(msg);
    dataChannel.onopen = () => updateConnectionStatus("Connected to peer.");
};

function onReceiveMessageCallback(event) {
    if (!receivedFile.name) {
        receivedFile = JSON.parse(event.data);
        progressbar.max = receivedFile.size;
        progressbar.value = 0;
        return;
    }

    receiveBuffer.push(event.data);
    receivedSize += event.data.byteLength;
    progressbar.value = receivedSize;
    progressLabel.innerHTML = "Received: " + ((receivedSize / receivedFile.size) * 100).toFixed(1) + "%";

    if (receivedSize === receivedFile.size) {
        const blob = new Blob(receiveBuffer, { type: receivedFile.type });
        downloadAnchor.href = URL.createObjectURL(blob);
        downloadAnchor.download = receivedFile.name;
        downloadAnchor.innerHTML = "Download " + receivedFile.name;
        receiveBuffer = [];
        receivedSize = 0;
        receivedFile = {};
    }
}

function updateConnectionStatus(status) {
    document.getElementById("connectionStatus").innerHTML = status;
}
