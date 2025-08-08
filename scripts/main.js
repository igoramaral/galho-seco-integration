const API_EXPORT_ENDPOINT = "/foundry/characters";
const API_URL = "http://localhost:3000/api/v1"; // Substitua pela URL real da sua API

async function sendCharactersToApi() {
    const apiKey = game.settings.get("galho-seco-integration", "apiKey");
    const username = game.settings.get("galho-seco-integration", "username");

    if (!apiKey || !username) {
        console.warn("[Galho Seco Integration] API Key ou usuário não definidos.");
        return;
    }

    const user = game.users.find((u) => u.name === username);
    if (!user) {
    
        throw new Error(`Usuário "${username}" não encontrado.`);
    }
    const userId = user._id;

    const characters = game.actors.filter(
    (actor) =>
        actor.type === "character" &&
        actor.ownership[userId] === 3
    );

    const payload = {
        username,
        characters: characters.map(actor => ({
            id: actor.id,
            name: actor.name,
            type: actor.type,
            img: actor.img,
            system: actor.system, // inclui atributos resolvidos
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
            throw new Error(
                `Erro ${response.status}: ${await response.text()}`
            );
        }

        console.log("[Galho Seco Integration] Personagens enviados com sucesso.");
    } catch (err) {
        console.error("[Galho Seco Integration] Falha ao enviar personagens:", err);
    }
}

async function sendSingleCharacterToApi(actor) {
    const apiKey = game.settings.get("galho-seco-integration", "apiKey");
    const username = game.settings.get("galho-seco-integration", "username");

    if (!apiKey || !username) return;

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

        console.log("[Galho Seco Integration] Personagem enviado com sucesso:", actor.name);
    } catch (err) {
        console.error("[Galho Seco Integration] Falha ao enviar personagem:", actor.name, err);
    }
}

async function sendDeleteCharacterToApi(actor) {
    const apiKey = game.settings.get("galho-seco-integration", "apiKey");
    const username = game.settings.get("galho-seco-integration", "username");

    if (!apiKey || !username) return;

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

async function isCharacterSynced(character){
    const username = game.settings.get("galho-seco-integration", "username");
    const user = game.users.find((u) => u.name === username);

    if (!user) {
        console.warn(`[Galho Seco Integration] Usuário "${username}" não encontrado.`);
        return false;
    }

    const userId = user.id || user._id;

    // Verifica se o ator pertence ao usuário configurado
    return character?.ownership?.[userId] === 3;
}

let sendIntervalHandle = null;
function scheduleSend(interval) {
    if (sendIntervalHandle) clearInterval(sendIntervalHandle);
    sendIntervalHandle = setInterval(() => sendCharactersToApi(), interval);
}

Hooks.once("init", () => {
    console.log("Galho Seco Integration | Initializing Configs");

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

    game.settings.register("galho-seco-integration", "apiKey", {
        name: "API Key",
        hint: "Sua chave de autenticação para acessar a API externa.",
        scope: "world",
        config: true,
        type: String,
        default: "",
    });

    game.settings.register("galho-seco-integration", "username", {
        name: "Usuário",
        hint: "Identificação do usuário que deverá ter seus personages exportados.",
        scope: "world",
        config: true,
        type: String,
        default: "",
    });
});

Hooks.once("ready", () => {
    console.log("[Galho Seco Integration] Módulo pronto. Agendando envio periódico...");
    const intervalSetting = game.settings.get("galho-seco-integration", "updateInterval");
    const intervalMs = (intervalSetting || 0.5) * 60 * 1000;
    scheduleSend(intervalMs);

    Hooks.on("updateActor", async (actor) => {
        if (actor.type !== "character") return;
        const username = game.settings.get("galho-seco-integration", "username");

        if (await isCharacterSynced(actor)) {
            console.log("[Galho Seco Integration] Ator atualizado e pertence ao usuário:", username);
            sendSingleCharacterToApi(actor);
        } else {
            console.log("[Galho Seco Integration] Ator atualizado, mas não pertence ao usuário:", username);
        }
    });

    Hooks.on("deleteActor", async (actor) => {
        if (actor.type !== "character") return;
        const username = game.settings.get("galho-seco-integration", "username");

        if (await isCharacterSynced(actor)) {
            console.log("[Galho Seco Integration] Ator deletado e pertencia ao usuário:", username);
            sendDeleteCharacterToApi(actor);
        } else {
            console.log("[Galho Seco Integration] Ator deletado, mas não pertence ao usuário:", username);
        }
    });

    Hooks.on("createItem", async (item) => {
        const actor = item.parent;
        const username = game.settings.get("galho-seco-integration", "username");

        if (actor.type !== "character") return;

        if (await isCharacterSynced(actor)) {
            console.log("[Galho Seco Integration] Item criado no personagem ", actor.name, ", que pertence ao usuário:", username);
            sendSingleCharacterToApi(actor);
        } else {
            console.log("[Galho Seco Integration] Item criado, mas não pertence ao usuário:", username);
        }
    });

    Hooks.on("updateItem", async(item) => {
        const actor = item.parent;
        const username = game.settings.get("galho-seco-integration", "username");

        if (actor.type !== "character") return;

        if (await isCharacterSynced(actor)) {
            console.log("[Galho Seco Integration] Item atualizado no personagem ", actor.name, ", que pertence ao usuário:", username);
            sendSingleCharacterToApi(actor);
        } else {
            console.log("[Galho Seco Integration] Item atualizado, mas não pertence ao usuário:", username);
        }
    });

    Hooks.on("deleteItem", async(item) => {
        const actor = item.parent;
        const username = game.settings.get("galho-seco-integration", "username");

        if (actor.type !== "character") return;

        if (await isCharacterSynced(actor)) {
            console.log("[Galho Seco Integration] Item excluído no personagem ", actor.name, ", que pertence ao usuário:", username);
            sendSingleCharacterToApi(actor);
        } else {
            console.log("[Galho Seco Integration] Item excluído, mas não pertence ao usuário:", username);
        }
    });

    console.log("[Galho Seco Integration] Observadores ativados.");
});




