import GalhoSecoUsersConfig from "./config/GalhoSecoUsersConfig.js";
import connectWebSocket from "./wsManager.js";
import { sendSingleCharacterToApi, sendCharactersToApi, sendDeleteCharacterToApi, isCharacterSynced } from "./util/syncUtil.js";

let sendIntervalHandle = null;
function scheduleSend(interval) {
    if (sendIntervalHandle) clearInterval(sendIntervalHandle);
    const url = game.settings.get("galho-seco-integration", "serverUrl");
    if (!url) return;
    sendIntervalHandle = setInterval(() => sendCharactersToApi(), interval);
}

function connectToWebSocket(){
    if (!game.user.isGM) {
        console.log('[Galho Seco Integration] Usuário não é GM — WebSocket não será conectado.');
        return;
    }

    console.log('[Galho Seco Integration] Usuário é GM — iniciando conexão WebSocket.');
    
    const wsManager = connectWebSocket();

    if(wsManager){
        window.galhoSecoWS = wsManager;
        console.log('[Galho Seco Integration] Usuário é GM — Conexão WebSocket iniciada com sucesso!');
    } 
}

function activateListeners(){
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
}

Hooks.once("init", () => {

    console.log("[Galho Seco Integration] Inicializando Configs");

    const cssPath = "modules/galho-seco-integration/styles/galho-seco-users-config.css";
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = cssPath;
    document.head.appendChild(link);

    game.settings.register("galho-seco-integration", "serverUrl", {
        name: "Url do Servidor",
        hint: "Url de Conexão com o servidor Galho Seco",
        scope: "world", 
        config: true, 
        type: String,
        default: '',
        onChange: value => {
            console.log("[Galho Seco Integration] URL do servidor alterada para:", value);
            connectToWebSocket();
        } 
    });

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
        scope: "world", 
        config: false, 
        type: Array,
        default: [], 
    });
});

Hooks.once("ready", async () => {
    if (!game.user.isGM) return;

    game.settings.registerMenu("galho-seco-integration", "usersConfigMenu", {
        name: "Configurar Integrações por Usuário",
        label: "Editar usuários e API Keys",
        hint: "Adicione múltiplos usuários e suas chaves de API para sincronização com o app",
        icon: "fas fa-users-cog",
        type: GalhoSecoUsersConfig,
        restricted: true
    });

    activateListeners();
    connectToWebSocket();
});