const API_EXPORT_ENDPOINT = "/api/v1/foundry/characters";

export async function sendCharactersToApi() {
    const API_URL = game.settings.get("galho-seco-integration", "serverUrl");
    if(!API_URL){
        console.warn("[Galho Seco Integration] URL do servidor não configurada. Cancelando.");
        return;
    }

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
            characters: characters.map(actor => {
                const data = actor.getRollData();
                for (const ability of Object.values(data.abilities || {})) {
                    if (ability.save && "value" in ability.save) {
                        delete ability.save; // remove campo legado
                    }
                }

                return({
                    id: actor.id,
                    name: actor.name,
                    type: actor.type,
                    img: actor.img,
                    system: data,
                    items: actor.items.map(item => item.toObject()),
                    effects: actor.effects.map(effect => effect.toObject())
            })})
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

export async function sendSingleCharacterToApi(actor) {
    const API_URL = game.settings.get("galho-seco-integration", "serverUrl");
    if(!API_URL){
        console.warn("[Galho Seco Integration] URL do servidor não configurada. Cancelando.");
        return;
    }

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

        const data = actor.getRollData();
        for (const ability of Object.values(data.abilities || {})) {
            if (ability.save && "value" in ability.save) {
                delete ability.save; // remove campo legado
            }
        }

        const payload = {
            username,
            characters: [{
                id: actor.id,
                name: actor.name,
                type: actor.type,
                img: actor.img,
                system: data,
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

export async function sendDeleteCharacterToApi(actor) {
    const API_URL = game.settings.get("galho-seco-integration", "serverUrl");
    if(!API_URL){
        console.warn("[Galho Seco Integration] URL do servidor não configurada. Cancelando.");
        return;
    }

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

export async function isCharacterSynced(character) {
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