const API = "";

let token =
    localStorage.getItem(
        "social_token"
    );

let me = null;
let selectedUser = null;
let socket = null;

let cameraStream = null;
let peer = null;
let localCallStream = null;

const $ = id =>
    document.getElementById(id);


/* =========================
   UTILIDADES
========================= */

function show(id) {
    $(id).classList.remove(
        "hidden"
    );
}

function hide(id) {
    $(id).classList.add(
        "hidden"
    );
}

function message(
    element,
    text,
    error = false
) {

    element.textContent = text;

    element.className =
        error
            ? "message error"
            : "message success";
}

async function api(
    url,
    options = {}
) {

    options.headers =
        options.headers || {};

    if (token) {
        options.headers.Authorization =
            "Bearer " + token;
    }

    const response =
        await fetch(
            API + url,
            options
        );

    const data =
        await response
            .json()
            .catch(
                () => ({})
            );

    if (!response.ok) {
        throw new Error(
            data.error ||
            "Error del servidor"
        );
    }

    return data;
}


/* =========================
   PANTALLAS
========================= */

$("showRegisterBtn").onclick =
    () => {

        hide("loginScreen");
        show("registerScreen");

    };

$("showLoginBtn").onclick =
    () => {

        hide("registerScreen");
        show("loginScreen");

    };


/* =========================
   REGISTRO
========================= */

$("registerBtn").onclick =
    async () => {

        const name =
            $("registerName")
                .value
                .trim();

        const phone =
            $("registerPhone")
                .value
                .trim();

        const birthday =
            $("registerBirthday")
                .value;

        const username =
            $("registerUsername")
                .value
                .trim();

        const password =
            $("registerPassword")
                .value;

        const box =
            $("registerMessage");

        if (
            !name ||
            !phone ||
            !birthday ||
            !username ||
            !password
        ) {

            message(
                box,
                "Completa todos los campos",
                true
            );

            return;
        }

        try {

            message(
                box,
                "Creando cuenta..."
            );

            const data =
                await api(
                    "/api/register",
                    {
                        method: "POST",
                        headers: {
                            "Content-Type":
                                "application/json"
                        },
                        body:
                            JSON.stringify({
                                name,
                                phone,
                                birthday,
                                username,
                                password
                            })
                    }
                );

            token =
                data.token;

            localStorage.setItem(
                "social_token",
                token
            );

            me =
                data.user;

            openApp();

        } catch (error) {

            message(
                box,
                error.message,
                true
            );
        }
    };


/* =========================
   LOGIN
========================= */

$("loginBtn").onclick =
    async () => {

        const phone =
            $("loginPhone")
                .value
                .trim();

        const password =
            $("loginPassword")
                .value;

        const box =
            $("loginMessage");

        if (!phone || !password) {

            message(
                box,
                "Escribe tu número y contraseña",
                true
            );

            return;
        }

        try {

            message(
                box,
                "Entrando..."
            );

            const data =
                await api(
                    "/api/login",
                    {
                        method: "POST",
                        headers: {
                            "Content-Type":
                                "application/json"
                        },
                        body:
                            JSON.stringify({
                                phone,
                                password
                            })
                    }
                );

            token =
                data.token;

            localStorage.setItem(
                "social_token",
                token
            );

            me =
                data.user;

            openApp();

        } catch (error) {

            message(
                box,
                error.message,
                true
            );
        }
    };


/* =========================
   ABRIR APP
========================= */

async function openApp() {

    hide("loginScreen");
    hide("registerScreen");
    show("mainApp");

    await loadMe();

    connectSocket();

    loadUsers();

    showPage(
        "homePage"
    );
}


/* =========================
   PERFIL
========================= */

async function loadMe() {

    try {

        const data =
            await api(
                "/api/me"
            );

        me =
            data.user;

        $("topName")
            .textContent =
            me.name;

        $("welcomeName")
            .textContent =
            "Hola, " +
            me.name;

        $("streakValue")
            .textContent =
            me.streak;

        $("bestStreakValue")
            .textContent =
            me.bestStreak;

        const created =
            new Date(
                me.createdAt
            );

        const days =
            Math.floor(
                (
                    Date.now() -
                    created.getTime()
                ) /
                86400000
            );

        $("accountDays")
            .textContent =
            days;

        $("memberSince")
            .textContent =
            "Miembro desde " +
            created.toLocaleDateString();

        $("profileName")
            .textContent =
            me.name;

        $("profileUsername")
            .textContent =
            "@" +
            me.username;

        $("profilePhone")
            .textContent =
            "Teléfono: " +
            me.phone;

        $("profileBirthday")
            .textContent =
            "Nacimiento: " +
            me.birthday;

        $("profileCreated")
            .textContent =
            "Cuenta creada: " +
            created.toLocaleString();

        $("profileAge")
            .textContent =
            "Días en la app: " +
            days;

        $("profileStreak")
            .textContent =
            "Racha: " +
            me.streak +
            " días | Mejor: " +
            me.bestStreak;

        $("avatar")
            .textContent =
            me.name
                .charAt(0)
                .toUpperCase();

    } catch (error) {

        logout();
    }
}


/* =========================
   NAVEGACIÓN
========================= */

document
    .querySelectorAll(
        "[data-page]"
    )
    .forEach(button => {

        button.onclick =
            () => {

                showPage(
                    button.dataset.page
                );

            };
    });

function showPage(page) {

    document
        .querySelectorAll(
            ".page"
        )
        .forEach(item =>
            item.classList.add(
                "hidden"
            )
        );

    $(page)
        .classList.remove(
            "hidden"
        );
}


/* =========================
   USUARIOS
========================= */

async function loadUsers(
    search = ""
) {

    try {

        const data =
            await api(
                "/api/users?search=" +
                encodeURIComponent(
                    search
                )
            );

        const list =
            $("usersList");

        list.innerHTML = "";

        data.users.forEach(
            user => {

                const button =
                    document.createElement(
                        "button"
                    );

                button.className =
                    "userItem";

                button.innerHTML = `
                    <span class="userAvatar">
                        ${escapeHTML(
                            user.name
                                .charAt(0)
                                .toUpperCase()
                        )}
                    </span>

                    <span class="userInfo">
                        <strong>
                            ${escapeHTML(
                                user.name
                            )}
                        </strong>

                        <small>
                            @${escapeHTML(
                                user.username
                            )}
                        </small>

                        <small class="${
                            user.online
                                ? "online"
                                : ""
                        }">
                            ${
                                user.online
                                    ? "En línea"
                                    : "Desconectado"
                            }
                        </small>
                    </span>
                `;

                button.onclick =
                    () => {

                        selectUser(
                            user
                        );
                    };

                list.appendChild(
                    button
                );
            }
        );

    } catch (error) {

        console.error(error);
    }
}

$("userSearch").oninput =
    event => {

        loadUsers(
            event.target.value
        );
    };


/* =========================
   SELECCIONAR CHAT
========================= */

async function selectUser(
    user
) {

    selectedUser =
        user;

    $("chatName")
        .textContent =
        user.name;

    $("chatStatus")
        .textContent =
        user.online
            ? "En línea"
            : "Desconectado";

    await loadMessages();
}


/* =========================
   MENSAJES
========================= */

async function loadMessages() {

    if (!selectedUser) {
        return;
    }

    try {

        const data =
            await api(
                "/api/messages/" +
                encodeURIComponent(
                    selectedUser.id
                )
            );

        const box =
            $("messages");

        box.innerHTML = "";

        data.messages.forEach(
            renderMessage
        );

        box.scrollTop =
            box.scrollHeight;

    } catch (error) {

        console.error(error);
    }
}

function renderMessage(
    msg
) {

    const item =
        document.createElement(
            "div"
        );

    const mine =
        msg.senderId ===
        me.id;

    item.className =
        mine
            ? "messageBubble mine"
            : "messageBubble";

    let html = "";

    if (msg.content) {

        html +=
            `<div>${escapeHTML(
                msg.content
            )}</div>`;
    }

    if (msg.mediaUrl) {

        if (
            msg.mediaType &&
            msg.mediaType.startsWith(
                "image/"
            )
        ) {

            html += `
                <img
                    class="chatImage"
                    src="${msg.mediaUrl}"
                    alt="imagen"
                >
            `;

        } else if (
            msg.mediaType &&
            msg.mediaType.startsWith(
                "video/"
            )
        ) {

            html += `
                <video
                    class="chatVideo"
                    src="${msg.mediaUrl}"
                    controls
                    playsinline
                ></video>
            `;

        } else if (
            msg.mediaType &&
            msg.mediaType.startsWith(
                "audio/"
            )
        ) {

            html += `
                <audio
                    src="${msg.mediaUrl}"
                    controls
                ></audio>
            `;

        } else {

            html += `
                <a
                    href="${msg.mediaUrl}"
                    target="_blank"
                >
                    Abrir archivo
                </a>
            `;
        }
    }

    item.innerHTML =
        html;

    $("messages")
        .appendChild(item);
}


/* =========================
   ENVIAR MENSAJE
========================= */

$("sendBtn").onclick =
    sendMessage;

$("messageInput").addEventListener(
    "keydown",
    event => {

        if (
            event.key === "Enter"
        ) {
            sendMessage();
        }
    }
);

async function sendMessage() {

    if (!selectedUser) {

        alert(
            "Selecciona un usuario"
        );

        return;
    }

    const input =
        $("messageInput");

    const content =
        input.value.trim();

    if (!content) {
        return;
    }

    input.value = "";

    try {

        const data =
            await api(
                "/api/messages",
                {
                    method: "POST",
                    headers: {
                        "Content-Type":
                            "application/json"
                    },
                    body:
                        JSON.stringify({
                            receiverId:
                                selectedUser.id,
                            content
                        })
                }
            );

        renderMessage(
            data.message
        );

        $("messages")
            .scrollTop =
            $("messages")
                .scrollHeight;

    } catch (error) {

        alert(
            error.message
        );
    }
}


/* =========================
   ARCHIVOS
========================= */

$("mediaBtn").onclick =
    () => {

        $("mediaInput").click();

    };

$("mediaInput").onchange =
    async event => {

        const file =
            event.target.files[0];

        if (!file) {
            return;
        }

        if (!selectedUser) {

            alert(
                "Selecciona un usuario"
            );

            return;
        }

        try {

            const form =
                new FormData();

            form.append(
                "file",
                file
            );

            const upload =
                await api(
                    "/api/upload",
                    {
                        method: "POST",
                        body: form
                    }
                );

            const data =
                await api(
                    "/api/messages",
                    {
                        method: "POST",
                        headers: {
                            "Content-Type":
                                "application/json"
                        },
                        body:
                            JSON.stringify({
                                receiverId:
                                    selectedUser.id,
                                mediaUrl:
                                    upload.url,
                                mediaType:
                                    upload.type
                            })
                    }
                );

            renderMessage(
                data.message
            );

        } catch (error) {

            alert(
                error.message
            );
        }

        event.target.value = "";
    };


/* =========================
   CÁMARA
========================= */

$("cameraBtn").onclick =
    openCamera;

$("closeCameraBtn").onclick =
    closeCamera;

$("takePhotoBtn").onclick =
    takePhoto;

async function openCamera() {

    try {

        cameraStream =
            await navigator.mediaDevices
                .getUserMedia({
                    video: {
                        facingMode:
                            "environment"
                    },
                    audio: false
                });

        $("cameraVideo")
            .srcObject =
            cameraStream;

        show(
            "cameraOverlay"
        );

    } catch (error) {

        alert(
            "No se pudo abrir la cámara. Revisa el permiso del navegador."
        );
    }
}

function closeCamera() {

    if (cameraStream) {

        cameraStream
            .getTracks()
            .forEach(
                track =>
                    track.stop()
            );

        cameraStream =
            null;
    }

    hide(
        "cameraOverlay"
    );
}

async function takePhoto() {

    if (!cameraStream) {
        return;
    }

    const video =
        $("cameraVideo");

    const canvas =
        $("photoCanvas");

    canvas.width =
        video.videoWidth;

    canvas.height =
        video.videoHeight;

    const context =
        canvas.getContext(
            "2d"
        );

    context.drawImage(
        video,
        0,
        0,
        canvas.width,
        canvas.height
    );

    canvas.toBlob(
        async blob => {

            const file =
                new File(
                    [blob],
                    "foto.jpg",
                    {
                        type:
                            "image/jpeg"
                    }
                );

            closeCamera();

            await sendFile(
                file
            );

        },
        "image/jpeg",
        0.9
    );
}

async function sendFile(
    file
) {

    if (!selectedUser) {

        alert(
            "Selecciona un usuario"
        );

        return;
    }

    try {

        const form =
            new FormData();

        form.append(
            "file",
            file
        );

        const upload =
            await api(
                "/api/upload",
                {
                    method: "POST",
                    body: form
                }
            );

        const data =
            await api(
                "/api/messages",
                {
                    method: "POST",
                    headers: {
                        "Content-Type":
                            "application/json"
                    },
                    body:
                        JSON.stringify({
                            receiverId:
                                selectedUser.id,
                            mediaUrl:
                                upload.url,
                            mediaType:
                                upload.type
                        })
                }
            );

        renderMessage(
            data.message
        );

    } catch (error) {

        alert(
            error.message
        );
    }
}


/* =========================
   MARCADOR
========================= */

document
    .querySelectorAll(
        ".dialKey"
    )
    .forEach(button => {

        button.onclick =
            () => {

                $("dialNumber")
                    .value +=
                    button.dataset.key;
            };
    });

$("deleteDial").onclick =
    () => {

        $("dialNumber")
            .value =
            $("dialNumber")
                .value
                .slice(0, -1);
    };

$("callNumberBtn").onclick =
    () => {

        const number =
            $("dialNumber")
                .value;

        if (!number) {

            $("callMessage")
                .textContent =
                "Escribe un número.";

            return;
        }

        /*
         * Aquí no fingimos una llamada real.
         * El navegador necesita un proveedor
         * de telefonía/VoIP para llamar a
         * números celulares normales.
         */

        $("callMessage")
            .textContent =
            "Número marcado: " +
            number;

        /*
         * Si el dispositivo permite
         * enlaces tel:, abrimos el
         * marcador del teléfono.
         */

        window.location.href =
            "tel:" +
            encodeURIComponent(
                number
            );
    };


/* =========================
   WEBSOCKET
========================= */

function connectSocket() {

    if (!token) {
        return;
    }

    const protocol =
        location.protocol === "https:"
            ? "wss:"
            : "ws:";

    socket =
        new WebSocket(
            protocol +
            "//" +
            location.host
        );

    socket.onopen =
        () => {

            socket.send(
                JSON.stringify({
                    type: "auth",
                    token
                })
            );
        };

    socket.onmessage =
        async event => {

            try {

                const data =
                    JSON.parse(
                        event.data
                    );

                if (
                    data.type ===
                    "message"
                ) {

                    if (
                        selectedUser &&
                        (
                            data.message
                                .senderId ===
                            selectedUser.id
                            ||
                            data.message
                                .receiverId ===
                            selectedUser.id
                        )
                    ) {

                        renderMessage(
                            data.message
                        );

                        $("messages")
                            .scrollTop =
                            $("messages")
                                .scrollHeight;
                    }
                }

                if (
                    data.type ===
                    "call-offer"
                ) {

                    await receiveCall(
                        data
                    );
                }

                if (
                    data.type ===
                    "call-answer"
                ) {

                    await receiveAnswer(
                        data
                    );
                }

                if (
                    data.type ===
                    "ice-candidate"
                ) {

                    await receiveCandidate(
                        data
                    );
                }

                if (
                    data.type ===
                    "call-end"
                ) {

                    endCall();
                }

            } catch (error) {

                console.error(
                    error
                );
            }
        };
}


/* =========================
   LLAMADAS WEBRTC
========================= */

async function createPeer(
    target
) {

    peer =
        new RTCPeerConnection({
            iceServers: [
                {
                    urls:
                        "stun:stun.l.google.com:19302"
                },
                {
                    urls:
                        "stun:stun1.l.google.com:19302"
                }
            ]
        });

    peer.onicecandidate =
        event => {

            if (
                event.candidate &&
                socket
            ) {

                socket.send(
                    JSON.stringify({
                        type:
                            "ice-candidate",
                        target,
                        candidate:
                            event.candidate
                    })
                );
            }
        };

    peer.ontrack =
        event => {

            let video =
                document.getElementById(
                    "remoteCallVideo"
                );

            if (!video) {

                video =
                    document.createElement(
                        "video"
                    );

                video.id =
                    "remoteCallVideo";

                video.autoplay =
                    true;

                video.playsInline =
                    true;

                video.className =
                    "remoteCallVideo";

                $("callOverlay")
                    .appendChild(
                        video
                    );
            }

            video.srcObject =
                event.streams[0];
        };
}


async function startAppCall(
    video
) {

    if (!selectedUser) {

        alert(
            "Selecciona un usuario primero"
        );

        return;
    }

    try {

        localCallStream =
            await navigator.mediaDevices
                .getUserMedia({
                    audio: true,
                    video
                });

        await createPeer(
            selectedUser.id
        );

        localCallStream
            .getTracks()
            .forEach(
                track =>
                    peer.addTrack(
                        track,
                        localCallStream
                    )
            );

        const offer =
            await peer.createOffer();

        await peer.setLocalDescription(
            offer
        );

        socket.send(
            JSON.stringify({
                type:
                    "call-offer",
                target:
                    selectedUser.id,
                offer
            })
        );

        $("callTitle")
            .textContent =
            video
                ? "Videollamada"
                : "Llamada";

        $("callNumberDisplay")
            .textContent =
            selectedUser.name;

        show(
            "callOverlay"
        );

    } catch (error) {

        alert(
            "No se pudo iniciar la llamada."
        );
    }
}


async function receiveCall(
    data
) {

    try {

        await createPeer(
            data.from
        );

        localCallStream =
            await navigator.mediaDevices
                .getUserMedia({
                    audio: true,
                    video: true
                });

        localCallStream
            .getTracks()
            .forEach(
                track =>
                    peer.addTrack(
                        track,
                        localCallStream
                    )
            );

        await peer.setRemoteDescription(
            data.offer
        );

        const answer =
            await peer.createAnswer();

        await peer.setLocalDescription(
            answer
        );

        socket.send(
            JSON.stringify({
                type:
                    "call-answer",
                target:
                    data.from,
                answer
            })
        );

        $("callTitle")
            .textContent =
            "Llamada entrante";

        show(
            "callOverlay"
        );

    } catch (error) {

        console.error(
            error
        );
    }
}


async function receiveAnswer(
    data
) {

    if (!peer) {
        return;
    }

    await peer.setRemoteDescription(
        data.answer
    );
}


async function receiveCandidate(
    data
) {

    if (
        peer &&
        data.candidate
    ) {

        try {

            await peer.addIceCandidate(
                data.candidate
            );

        } catch (error) {

            console.error(
                error
            );
        }
    }
}


function endCall() {

    if (peer) {

        peer.close();
        peer = null;
    }

    if (localCallStream) {

        localCallStream
            .getTracks()
            .forEach(
                track =>
                    track.stop()
            );

        localCallStream =
            null;
    }

    hide(
        "callOverlay"
    );

    const remote =
        document.getElementById(
            "remoteCallVideo"
        );

    if (remote) {
        remote.remove();
    }
}

$("hangupBtn").onclick =
    () => {

        if (
            socket &&
            selectedUser
        ) {

            socket.send(
                JSON.stringify({
                    type:
                        "call-end",
                    target:
                        selectedUser.id
                })
            );
        }

        endCall();
    };


/* =========================
   LOGOUT
========================= */

$("logoutBtn").onclick =
    logout;

function logout() {

    token = null;
    me = null;
    selectedUser = null;

    localStorage.removeItem(
        "social_token"
    );

    if (socket) {

        socket.close();
        socket = null;
    }

    endCall();

    hide("mainApp");
    show("loginScreen");
}


/* =========================
   SEGURIDAD HTML
========================= */

function escapeHTML(
    value
) {

    return String(value)
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );
}


/* =========================
   SESIÓN AUTOMÁTICA
========================= */

(async function () {

    if (!token) {
        return;
    }

    try {

        await openApp();

    } catch {

        logout();
    }

})();