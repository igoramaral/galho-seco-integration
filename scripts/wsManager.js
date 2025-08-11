import processRequests from "./util/processRequests.js";

export default function connectWebSocket() {
    const socketUrl = "ws://localhost:3000";
    let socket = null;
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 10;
    const reconnectDelay = 3000;

    function createSocket() {
        socket = new WebSocket(socketUrl);

        socket.addEventListener("open", () => {
            console.log("WebSocket conectado");
            reconnectAttempts = 0;

            const worldTitle = game.world.title;
            const users =
                game.settings.get("galho-seco-integration", "users") || [];
            const apiKeys = users.map((u) => u.apiKey).filter((k) => k);

            if (apiKeys.length === 0) {
                console.warn(
                    "Nenhuma apiKey cadastrada no módulo. Fechando conexão WebSocket."
                );
                socket.close(1000, "Nenhuma apiKey cadastrada");
                return;
            }

            const registerMsg = {
                type: "register-world",
                worldTitle,
                apiKeys,
            };
            socket.send(JSON.stringify(registerMsg));
            console.log("Mensagem register-world enviada:", registerMsg);
        });

        socket.addEventListener("message", async (event) => {
            const data = JSON.parse(event.data);
            console.log("Mensagem recebida do servidor", data);

            //Trata mensagens que aguardam resposta
            if(data.requestId){
                let result;

                //Trata rolagens de testes solicitadas pelo App
                if (data.type === "roll-test") {
                    result = await processRequests.processTestRoll(data);
                }

                if (data.type === "roll-initiative") {
                    result = await processRequests.processInitiativeRoll(data);
                }

                socket.send(JSON.stringify({
                    requestId: data.requestId,
                    payload: result
                }));

            } else {
                // Trata updates de personagem feitos no App
                if (data.type === 'characterUpdated'){
                    await processRequests.processCharacterUpdated(data);
                }

                // Trata updates de item feitos no app
                if (data.type === "itemUpdated") {
                    await processRequests.processItemUpdated(data);
                }
            }    
        });

        socket.addEventListener("close", (event) => {
            console.log(
                `WebSocket desconectado: código=${event.code} motivo=${event.reason}`
            );

            if (event.code !== 1000) {
                if (reconnectAttempts < maxReconnectAttempts) {
                    reconnectAttempts++;
                    console.log(
                        `Tentando reconectar em ${reconnectDelay}ms... (tentativa ${reconnectAttempts}/${maxReconnectAttempts})`
                    );
                    setTimeout(() => {
                        createSocket();
                    }, reconnectDelay);
                } else {
                    console.error(
                        "Número máximo de tentativas de reconexão atingido. Parando."
                    );
                }
            } else {
                console.log("Conexão fechada normalmente, não reconectando.");
            }
        });

        socket.addEventListener("error", (err) => {
            console.error("Erro na conexão WebSocket:", err);
        });
    }

    createSocket();

    return {
        getSocket: () => socket,
        close: () => {
            reconnectAttempts = maxReconnectAttempts;
            if (socket) socket.close(1000, "Fechamento manual");
        },
    };
}
