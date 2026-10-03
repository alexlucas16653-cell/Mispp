const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;

const JWT_SECRET =
    process.env.JWT_SECRET ||
    "CAMBIA_ESTA_CLAVE_POR_UNA_MUY_LARGA_Y_SEGURA";

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const MESSAGES_FILE = path.join(DATA_DIR, "messages.json");
const MEDIA_DIR = path.join(ROOT, "media");

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

if (!fs.existsSync(MEDIA_DIR)) {
    fs.mkdirSync(MEDIA_DIR, { recursive: true });
}

if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(USERS_FILE, "[]");
}

if (!fs.existsSync(MESSAGES_FILE)) {
    fs.writeFileSync(MESSAGES_FILE, "[]");
}

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.use(express.static(ROOT));

app.use(
    "/media",
    express.static(MEDIA_DIR)
);

function readJSON(file) {
    try {
        return JSON.parse(
            fs.readFileSync(file, "utf8")
        );
    } catch {
        return [];
    }
}

function writeJSON(file, data) {
    fs.writeFileSync(
        file,
        JSON.stringify(data, null, 2)
    );
}

function cleanPhone(phone) {
    return String(phone || "")
        .replace(/[^\d+]/g, "")
        .replace(/(?!^)\+/g, "");
}

function generateId() {
    return crypto.randomUUID();
}

function generateUserId() {
    return "USR-" +
        crypto
            .randomBytes(5)
            .toString("hex")
            .toUpperCase();
}

function todayString() {
    return new Date()
        .toISOString()
        .slice(0, 10);
}

function daysBetween(a, b) {
    const x = new Date(a);
    const y = new Date(b);

    x.setHours(0, 0, 0, 0);
    y.setHours(0, 0, 0, 0);

    return Math.floor(
        Math.abs(y - x) / 86400000
    );
}

function updateStreak(user) {
    const today = todayString();

    if (!user.lastStreakDay) {
        user.streak = 1;
        user.bestStreak = Math.max(
            1,
            user.bestStreak || 1
        );
        user.lastStreakDay = today;
        return;
    }

    if (user.lastStreakDay === today) {
        return;
    }

    const previous = new Date(
        user.lastStreakDay
    );

    const current = new Date(today);

    const difference = Math.floor(
        (current - previous) / 86400000
    );

    if (difference === 1) {
        user.streak =
            Number(user.streak || 0) + 1;
    } else {
        user.streak = 1;
    }

    user.bestStreak = Math.max(
        Number(user.bestStreak || 1),
        Number(user.streak || 1)
    );

    user.lastStreakDay = today;
}

function publicUser(user) {
    return {
        id: user.id,
        username: user.username,
        name: user.name,
        avatar: user.avatar || null,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt,
        streak: user.streak,
        bestStreak: user.bestStreak,
        lastStreakDay: user.lastStreakDay,
        online: onlineUsers.has(user.id)
    };
}

function authToken(user) {
    return jwt.sign(
        {
            id: user.id
        },
        JWT_SECRET,
        {
            expiresIn: "30d"
        }
    );
}

function getUserFromToken(token) {
    try {
        const decoded = jwt.verify(
            token,
            JWT_SECRET
        );

        const users = readJSON(
            USERS_FILE
        );

        return users.find(
            user => user.id === decoded.id
        ) || null;

    } catch {
        return null;
    }
}

function requireAuth(req, res, next) {
    const header =
        req.headers.authorization || "";

    const token =
        header.startsWith("Bearer ")
            ? header.slice(7)
            : null;

    if (!token) {
        return res.status(401).json({
            error: "No autorizado"
        });
    }

    const user =
        getUserFromToken(token);

    if (!user) {
        return res.status(401).json({
            error: "Sesión inválida"
        });
    }

    req.user = user;
    next();
}


/* =========================
   REGISTRO
========================= */

app.post(
    "/api/register",
    async (req, res) => {

        try {

            const {
                name,
                phone,
                birthday,
                username,
                password
            } = req.body;

            if (
                !name ||
                !phone ||
                !birthday ||
                !username ||
                !password
            ) {
                return res.status(400).json({
                    error:
                        "Completa todos los campos"
                });
            }

            if (password.length < 6) {
                return res.status(400).json({
                    error:
                        "La contraseña debe tener al menos 6 caracteres"
                });
            }

            const clean =
                cleanPhone(phone);

            if (clean.length < 7) {
                return res.status(400).json({
                    error:
                        "Número de teléfono inválido"
                });
            }

            const users =
                readJSON(USERS_FILE);

            const normalizedUsername =
                String(username)
                    .trim()
                    .toLowerCase();

            if (
                users.some(
                    user =>
                        user.phone === clean
                )
            ) {
                return res.status(409).json({
                    error:
                        "Ese número ya está registrado"
                });
            }

            if (
                users.some(
                    user =>
                        user.username ===
                        normalizedUsername
                )
            ) {
                return res.status(409).json({
                    error:
                        "Ese nombre de usuario ya existe"
                });
            }

            const passwordHash =
                await bcrypt.hash(
                    password,
                    12
                );

            const now =
                new Date().toISOString();

            const user = {
                id: generateUserId(),
                username:
                    normalizedUsername,
                name:
                    String(name).trim(),
                phone: clean,
                birthday,
                passwordHash,
                avatar: null,
                createdAt: now,
                lastLoginAt: now,
                streak: 1,
                bestStreak: 1,
                lastStreakDay:
                    todayString()
            };

            users.push(user);

            writeJSON(
                USERS_FILE,
                users
            );

            const token =
                authToken(user);

            res.json({
                ok: true,
                token,
                user: publicUser(user)
            });

        } catch (error) {

            console.error(error);

            res.status(500).json({
                error:
                    "Error creando la cuenta"
            });
        }
    }
);


/* =========================
   LOGIN
========================= */

app.post(
    "/api/login",
    async (req, res) => {

        try {

            const {
                phone,
                password
            } = req.body;

            const clean =
                cleanPhone(phone);

            const users =
                readJSON(USERS_FILE);

            const user =
                users.find(
                    item =>
                        item.phone === clean
                );

            if (!user) {
                return res.status(401).json({
                    error:
                        "Número o contraseña incorrectos"
                });
            }

            const valid =
                await bcrypt.compare(
                    password,
                    user.passwordHash
                );

            if (!valid) {
                return res.status(401).json({
                    error:
                        "Número o contraseña incorrectos"
                });
            }

            updateStreak(user);

            user.lastLoginAt =
                new Date().toISOString();

            writeJSON(
                USERS_FILE,
                users
            );

            const token =
                authToken(user);

            res.json({
                ok: true,
                token,
                user: publicUser(user)
            });

        } catch (error) {

            console.error(error);

            res.status(500).json({
                error:
                    "Error iniciando sesión"
            });
        }
    }
);


/* =========================
   MI PERFIL
========================= */

app.get(
    "/api/me",
    requireAuth,
    (req, res) => {

        const users =
            readJSON(USERS_FILE);

        const user =
            users.find(
                item =>
                    item.id ===
                    req.user.id
            );

        if (!user) {
            return res.status(404).json({
                error: "Usuario no encontrado"
            });
        }

        res.json({
            ok: true,
            user: publicUser(user)
        });
    }
);


/* =========================
   USUARIOS
========================= */

app.get(
    "/api/users",
    requireAuth,
    (req, res) => {

        const users =
            readJSON(USERS_FILE);

        const search =
            String(
                req.query.search || ""
            )
                .trim()
                .toLowerCase();

        let result =
            users
                .filter(
                    user =>
                        user.id !==
                        req.user.id
                )
                .map(publicUser);

        if (search) {
            result =
                result.filter(
                    user =>
                        user.name
                            .toLowerCase()
                            .includes(search)
                        ||
                        user.username
                            .toLowerCase()
                            .includes(search)
                );
        }

        res.json({
            users: result.slice(0, 100)
        });
    }
);


/* =========================
   MENSAJES
========================= */

app.get(
    "/api/messages/:userId",
    requireAuth,
    (req, res) => {

        const otherId =
            req.params.userId;

        const messages =
            readJSON(MESSAGES_FILE);

        const result =
            messages.filter(
                message =>
                    (
                        message.senderId ===
                        req.user.id &&
                        message.receiverId ===
                        otherId
                    )
                    ||
                    (
                        message.senderId ===
                        otherId &&
                        message.receiverId ===
                        req.user.id
                    )
            );

        res.json({
            messages:
                result.slice(-500)
        });
    }
);


app.post(
    "/api/messages",
    requireAuth,
    (req, res) => {

        const {
            receiverId,
            content,
            mediaUrl,
            mediaType
        } = req.body;

        if (!receiverId) {
            return res.status(400).json({
                error:
                    "Falta el destinatario"
            });
        }

        if (
            !content &&
            !mediaUrl
        ) {
            return res.status(400).json({
                error:
                    "Mensaje vacío"
            });
        }

        const users =
            readJSON(USERS_FILE);

        const receiver =
            users.find(
                user =>
                    user.id ===
                    receiverId
            );

        if (!receiver) {
            return res.status(404).json({
                error:
                    "Usuario no encontrado"
            });
        }

        const messages =
            readJSON(MESSAGES_FILE);

        const message = {
            id: generateId(),
            senderId: req.user.id,
            receiverId,
            content:
                content
                    ? String(content)
                    : null,
            mediaUrl:
                mediaUrl || null,
            mediaType:
                mediaType || null,
            createdAt:
                new Date().toISOString()
        };

        messages.push(message);

        writeJSON(
            MESSAGES_FILE,
            messages
        );

        broadcastToUser(
            receiverId,
            {
                type: "message",
                message
            }
        );

        res.json({
            ok: true,
            message
        });
    }
);


/* =========================
   SUBIR ARCHIVOS
========================= */

const storage =
    multer.diskStorage({

        destination:
            function (
                req,
                file,
                cb
            ) {
                cb(
                    null,
                    MEDIA_DIR
                );
            },

        filename:
            function (
                req,
                file,
                cb
            ) {

                const extension =
                    path.extname(
                        file.originalname
                    );

                cb(
                    null,
                    crypto.randomUUID() +
                    extension
                );
            }
    });

const upload =
    multer({
        storage,
        limits: {
            fileSize:
                200 * 1024 * 1024
        }
    });


app.post(
    "/api/upload",
    requireAuth,
    upload.single("file"),
    (req, res) => {

        if (!req.file) {
            return res.status(400).json({
                error:
                    "No se recibió archivo"
            });
        }

        const url =
            "/media/" +
            req.file.filename;

        res.json({
            ok: true,
            url,
            type:
                req.file.mimetype
        });
    }
);


/* =========================
   WEBSOCKET
========================= */

const onlineUsers =
    new Map();

function send(ws, data) {

    if (
        ws &&
        ws.readyState ===
            WebSocket.OPEN
    ) {
        ws.send(
            JSON.stringify(data)
        );
    }
}

function broadcastToUser(
    userId,
    data
) {

    const sockets =
        onlineUsers.get(userId);

    if (!sockets) {
        return;
    }

    for (
        const ws of sockets
    ) {
        send(ws, data);
    }
}

function addOnline(
    userId,
    ws
) {

    if (
        !onlineUsers.has(userId)
    ) {
        onlineUsers.set(
            userId,
            new Set()
        );
    }

    onlineUsers
        .get(userId)
        .add(ws);
}

function removeOnline(
    userId,
    ws
) {

    const sockets =
        onlineUsers.get(userId);

    if (!sockets) {
        return;
    }

    sockets.delete(ws);

    if (sockets.size === 0) {
        onlineUsers.delete(
            userId
        );
    }
}

wss.on(
    "connection",
    ws => {

        let userId = null;

        ws.on(
            "message",
            raw => {

                try {

                    const data =
                        JSON.parse(
                            raw.toString()
                        );

                    if (
                        data.type ===
                        "auth"
                    ) {

                        const user =
                            getUserFromToken(
                                data.token
                            );

                        if (!user) {
                            send(ws, {
                                type:
                                    "auth_error"
                            });

                            return;
                        }

                        userId =
                            user.id;

                        addOnline(
                            userId,
                            ws
                        );

                        send(ws, {
                            type:
                                "auth_ok"
                        });

                        return;
                    }


                    if (!userId) {
                        return;
                    }


                    /*
                     * SEÑALIZACIÓN WEBRTC
                     */

                    if (
                        data.type ===
                            "call-offer" ||
                        data.type ===
                            "call-answer" ||
                        data.type ===
                            "ice-candidate" ||
                        data.type ===
                            "call-end"
                    ) {

                        if (
                            !data.target
                        ) {
                            return;
                        }

                        broadcastToUser(
                            data.target,
                            {
                                type:
                                    data.type,
                                from:
                                    userId,
                                offer:
                                    data.offer ||
                                    null,
                                answer:
                                    data.answer ||
                                    null,
                                candidate:
                                    data.candidate ||
                                    null
                            }
                        );
                    }

                } catch (error) {

                    console.error(
                        "WS error:",
                        error
                    );
                }
            }
        );

        ws.on(
            "close",
            () => {

                if (userId) {

                    removeOnline(
                        userId,
                        ws
                    );

                }
            }
        );
    }
);


/* =========================
   SERVIDOR
========================= */

app.get(
    "*splat",
    (req, res) => {

        res.sendFile(
            path.join(
                ROOT,
                "index.html"
            )
        );
    }
);

server.listen(
    PORT,
    () => {

        console.log(
            `Servidor iniciado en puerto ${PORT}`
        );

    }
);