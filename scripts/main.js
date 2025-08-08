import GalhoSecoUsersConfig from "../forms/GalhoSecoUsersConfig.js";

const API_EXPORT_ENDPOINT = "/foundry/characters";
const API_URL = "http://localhost:3000/api/v1"; // Substitua pela URL real da sua API
const SOCKET_URL = "ws://localhost:3000";

async function sendCharactersToApi() {
    const usersConfig = game.settings.get("galho-seco-integration", "users");

    if (!Array.isArray(usersConfig) || usersConfig.length === 0) {
        console.warn("[Galho Seco Integration] Nenhum usuário configurado.");
        return;
    }

    for (const { userId, apiKey } of usersConfig) {
        if (!userId || !apiKey) {
            console.warn(`[Galho Seco Integration] Configuração inválida para um dos usuários:`, { userId, apiKey });
            continue;
        }

        const user = game.users.get(userId);
        if (!user) {
            console.warn(`[Galho Seco Integration] Usuário com ID "${userId}" não encontrado.`);
            continue;
        }

        const characters = game.actors.filter(
            (actor) =>
                actor.type === "character" &&
                actor.ownership?.[userId] === 3
        );

        const payload = {
            userId,
            characters: characters.map(actor => ({
                id: actor.id,
                name: actor.name,
                type: actor.type,
                img: actor.img,
                system: actor.getRollData(),
                items: actor.items.map(item => item.toObject()),
                effects: actor.effects.map(effect => effect.toObject())
            }))
        };

        try {
            const response = await fetch(`${API_URL}${API_EXPORT_ENDPOINT}`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${apiKey}`,
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                throw new Error(`Erro ${response.status}: ${await response.text()}`);
            }

            console.log(`[Galho Seco Integration] Personagens de "${user.name}" enviados com sucesso.`);
        } catch (err) {
            console.error(`[Galho Seco Integration] Falha ao enviar personagens de "${user.name}":`, err);
        }
    }
}

async function sendSingleCharacterToApi(actor) {
    const usersSetting = game.settings.get("galho-seco-integration", "users");
    if (!Array.isArray(usersSetting) || usersSetting.length === 0) return;

    const owners = Object.entries(actor.ownership ?? {})
        .filter(([_, level]) => level === 3)
        .map(([userId]) => userId);

    for (const userId of owners) {
        const entry = usersSetting.find((u) => u.userId === userId);
        const user = game.users.get(userId);

        if (!entry || !entry.apiKey || !user) continue;

        const apiKey = entry.apiKey;
        const username = user.name;

        const payload = {
            username,
            characters: [{
                id: actor.id,
                name: actor.name,
                type: actor.type,
                img: actor.img,
                system: actor.getRollData(), // inclui atributos resolvidos
                items: actor.items.map(item => item.toObject()),
                effects: actor.effects.map(effect => effect.toObject())
            }],
        };

        try {
            const response = await fetch(`${API_URL}${API_EXPORT_ENDPOINT}`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${apiKey}`,
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                throw new Error(`Erro ${response.status}: ${await response.text()}`);
            }

            console.log("[Galho Seco Integration] Personagem enviado com sucesso:", actor.name, "para", username);
        } catch (err) {
            console.error("[Galho Seco Integration] Falha ao enviar personagem:", actor.name, "para", username, err);
        }
    }
}

async function sendDeleteCharacterToApi(actor) {
    const usersSetting = game.settings.get("galho-seco-integration", "users");
    if (!Array.isArray(usersSetting) || usersSetting.length === 0) return;

    const owners = Object.entries(actor.ownership ?? {})
        .filter(([_, level]) => level === 3)
        .map(([userId]) => userId);

    for (const userId of owners) {
        const entry = usersSetting.find((u) => u.userId === userId);
        const user = game.users.get(userId);

        if (!entry || !entry.apiKey || !user) continue;

        const apiKey = entry.apiKey;
        const username = user.name;

        const payload = {
            character: actor._id,
        };

        try {
            const response = await fetch(`${API_URL}${API_EXPORT_ENDPOINT}`, {
                method: "DELETE",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${apiKey}`,
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                throw new Error(`Erro ${response.status}: ${await response.text()}`);
            }

            console.log("[Galho Seco Integration] Personagem deletado com sucesso:", actor.name);
        } catch (err) {
            console.error("[Galho Seco Integration] Falha ao deletar personagem:", actor.name, err);
        }
    }

}

async function isCharacterSynced(character) {
    const configuredUsers = game.settings.get("galho-seco-integration", "users");

    if (!Array.isArray(configuredUsers) || configuredUsers.length === 0) {
        console.warn("[Galho Seco Integration] Nenhum usuário configurado.");
        return false;
    }

    for (const { userId } of configuredUsers) {
        const user = game.users.get(userId);

        if (!user) {
            console.warn(`[Galho Seco Integration] Usuário "${userId}" não encontrado.`);
            continue;
        }

        const id = user.id || user._id;

        if (character?.ownership?.[id] === 3) {
            return true;
        }
    }

    return false;
}

let sendIntervalHandle = null;
function scheduleSend(interval) {
    if (sendIntervalHandle) clearInterval(sendIntervalHandle);
    sendIntervalHandle = setInterval(() => sendCharactersToApi(), interval);
}

Hooks.once("init", () => {
    console.log("Galho Seco Integration | Initializing Configs");

    const cssPath = "modules/galho-seco-integration/styles/galho-seco-users-config.css";
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = cssPath;
    document.head.appendChild(link);

    game.settings.register("galho-seco-integration", "updateInterval", {
        name: "Intervalo de Atualização",
        hint: "O intervalo de tempo (em minutos) que a integração deve enviar personagens pro aplicativo",
        scope: "world",
        config: true,
        type: Number,
        default: 0.5,
        onChange: value => {
            console.log("[Galho Seco Integration] Intervalo alterado para:", value);
            scheduleSend((value || 0.5) * 60 * 1000);
        }
    });

    game.settings.register("galho-seco-integration", "users", {
        name: "Usuários Galho Seco",
        scope: "world", // armazenado no mundo
        config: false, // não aparece nas configurações padrão
        type: Array,
        default: [], // array de objetos { userId, apiKey }
    });

    game.settings.register("galho-seco-integration", "userApiKeys", {
        name: "Usuários e API Keys",
        scope: "world",
        config: false,
        type: Object,
        default: {}
    });
});

Hooks.once("ready", async () => {
    game.settings.registerMenu("galho-seco-integration", "usersConfigMenu", {
        name: "Configurar Integrações por Usuário",
        label: "Editar usuários e API Keys",
        hint: "Adicione múltiplos usuários e suas chaves de API para sincronização com o app",
        icon: "fas fa-users-cog",
        type: GalhoSecoUsersConfig,
        restricted: true
    });

    console.log("[Galho Seco Integration] Módulo pronto. Agendando envio periódico...");
    const intervalSetting = game.settings.get("galho-seco-integration", "updateInterval");
    const intervalMs = (intervalSetting || 0.5) * 60 * 1000;
    scheduleSend(intervalMs);

    Hooks.on("updateActor", async (actor) => {
        if (actor.type !== "character") return;

        if (await isCharacterSynced(actor)) {
            console.log("[Galho Seco Integration] Ator atualizado e pertence a um usuário sincronizado");
            sendSingleCharacterToApi(actor);
        } else {
            console.log("[Galho Seco Integration] Ator atualizado, mas não pertence a um usuário sincronizado");
        }
    });

    Hooks.on("deleteActor", async (actor) => {
        if (actor.type !== "character") return;

        if (await isCharacterSynced(actor)) {
            console.log("[Galho Seco Integration] Ator deletado e pertencia a um usuário sincronizado");
            sendDeleteCharacterToApi(actor);
        } else {
            console.log("[Galho Seco Integration] Ator deletado, mas não pertence a um usuário sincronizado");
        }
    });

    Hooks.on("createItem", async (item) => {
        const actor = item.parent;

        if (actor.type !== "character") return;

        if (await isCharacterSynced(actor)) {
            console.log("[Galho Seco Integration] Item criado no personagem ", actor.name, ", que pertence a um usuário sincronizado");
            sendSingleCharacterToApi(actor);
        } else {
            console.log("[Galho Seco Integration] Item criado, mas não pertence a um usuário sincronizado");
        }
    });

    Hooks.on("updateItem", async(item) => {
        const actor = item.parent;

        if (actor.type !== "character") return;

        if (await isCharacterSynced(actor)) {
            console.log("[Galho Seco Integration] Item atualizado no personagem ", actor.name, ", que pertence a um usuário sincronizado");
            sendSingleCharacterToApi(actor);
        } else {
            console.log("[Galho Seco Integration] Item atualizado, mas não pertence a um usuário sincronizado");
        }
    });

    Hooks.on("deleteItem", async(item) => {
        const actor = item.parent;

        if (actor.type !== "character") return;

        if (await isCharacterSynced(actor)) {
            console.log("[Galho Seco Integration] Item excluído no personagem ", actor.name, ", que pertence a um usuário sincronizado");
            sendSingleCharacterToApi(actor);
        } else {
            console.log("[Galho Seco Integration] Item excluído, mas não pertence a um usuário sincronizado");
        }
    });

    console.log("[Galho Seco Integration] Observadores ativados.");

    if (!game.user.isGM) return;
    let socket;

    socket = new WebSocket(SOCKET_URL); // ou IP real do servidor

    socket.addEventListener("open", () => {
        console.log("[Galho Seco Integration] Conectado ao servidor WebSocket.");
        socket.send(JSON.stringify({ type: "foundry-ready", user: game.user.name }));
    });

    socket.addEventListener("message", (event) => {
        const data = JSON.parse(event.data);
        console.log("Mensagem do servidor:", data);
        // Trate mensagens recebidas aqui
    });

    socket.addEventListener("close", () => {
        console.warn("WebSocket fechado.");
    });

    socket.addEventListener("error", (err) => {
        console.error("Erro no WebSocket:", err);
    });

    console.log("[Galho Seco Integration] Listerners configurados");
});




