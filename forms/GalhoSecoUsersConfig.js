export default class GalhoSecoUsersConfig extends FormApplication {
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            id: "galho-seco-users-config",
            title: "Usuários e API Keys",
            template:
                "modules/galho-seco-integration/templates/galho-seco-users-config.html",
            width: 600,
            height: 300,
            classes: ["galho-seco-form"],
        });
    }

    async getData() {
        const storedUsers =
            game.settings.get("galho-seco-integration", "users") || [];

        const availableUsers = game.users.contents
            .filter((u) => !u.isGM)
            .map((u) => ({
                id: u.id,
                name: u.name,
            }));

        this.availableUsers = availableUsers;

        return {
            storedUsers,
            availableUsers,
        };
    }

    activateListeners(html) {
        super.activateListeners(html);

        // Lógica do botão adicionar linha
        html.find("#add-row").click(() => {
            const container = html.find("#user-rows");
            const index = container.children(".user-row").length;
            const users = this.availableUsers || [];

            const options = users
                .map(
                    (user) => `<option value="${user.id}">${user.name}</option>`
                )
                .join("");
            const newRow = $(`
        <div class="user-row" data-index="${index}">
          <select name="users[${index}][userId]">${options}</select>
          <input type="text" name="users[${index}][apiKey]" placeholder="API Key"/>
          <button type="button" class="clear-row">🧹</button>
          <button type="button" class="remove-row">❌</button>
        </div>
      `);
            container.append(newRow);
        });

        // Eventos para limpar e remover linha
        html.on("click", ".clear-row", (event) => {
            const row = $(event.currentTarget).closest(".user-row");
            row.find('input[name$="[apiKey]"]').val("");
        });

        html.on("click", ".remove-row", (event) => {
            $(event.currentTarget).closest(".user-row").remove();
        });
    }

        async _updateObject(event, formData) {
            event.preventDefault(); // previne comportamento padrão

            const users = [];
            const pattern = /^users\[(\d+)\]\[(userId|apiKey)\]$/;

            for (const [key, value] of Object.entries(formData)) {
            const match = key.match(pattern);
            if (!match) continue;

            const index = Number(match[1]);
            const field = match[2];

            if (!users[index]) users[index] = {};
            users[index][field] = value;
            }

            await game.settings.set("galho-seco-integration", "users", users);
            ui.notifications.info("Configurações salvas com sucesso.");
        }
}
