import prepareCharacterData from "./prepareCharacterData.js";
import { isCharacterSynced } from "./syncUtil.js";

const waitForDiceSoNiceAnimation = () => {
        return new Promise((resolve) => {
            const diceSoNiceActive = game.modules.get("dice-so-nice")?.active === true;

            if (diceSoNiceActive) {
            let resolved = false;

            const timeoutId = setTimeout(() => {
                if (!resolved) {
                resolved = true;
                resolve(null);
                }
            }, 5000);

            Hooks.once("diceSoNiceRollComplete", (message) => {
                if (!resolved) {
                clearTimeout(timeoutId);
                resolved = true;
                resolve(message);
                }
            });
            } else {
            resolve(null);
            }
        });
    };

class ProcessRequests {

    async processCharacterUpdated(data){
        console.log("[Galho Seco Integration] update de personagem recebido via WebSocket!");
        const preparedData = prepareCharacterData(data.message);
        let actor = game.actors.get(preparedData._id);
        if (actor && isCharacterSynced(actor)) {
            console.log(`[Galho Seco Integration] atualizando personagem personagem ${actor.id} - ${actor.name}`);
            await actor.update(preparedData);
        }
    }

    async processItemUpdated(data){
        console.log("[Galho Seco Integration] update de item recebido via WebSocket!");
        const itemData = data.item;
        const charId = data.charId;

        const character = game.actors.get(charId);
        const item = character.items.get(itemData._id)

        if(character && item && isCharacterSynced(character)){
            console.log(`[Galho Seco Integration] item ${item.id} - ${item.name} do personagem ${character.id} - ${character.name}`);
            await item.update({ system: itemData.system });
        }
    }

    async processTestRoll(data){
        console.log("[Galho Seco Integration] Teste recebido via WebSocket!");
        const testType = data.testType;
        const rollSubject = data.rollSubject;
        let advantage = null;
        const charId = data.charId;
        const config = { configure: false }
        const create = { create: true }

        switch(data.advantage){
            case "normal":
                break;
            case "vantagem":
                advantage = { advantage: true };
                break;
            case "desvantagem":
                advantage = { disadvantage: true}
                break
        }

        const actor = game.actors.get(charId);
        if (!actor){
            console.log("[Galho Seco Integration] Personagem não encontrado! Teste não executado");
            return;
        }

        let rollResult;

        switch(testType){
            case "atributo":
                rollResult = await actor.rollAbilityCheck({ ability: rollSubject, ...(advantage || {})}, config, create);
                break;
            case "savingThrow":
                rollResult = await actor.rollSavingThrow({ ability: rollSubject, ...(advantage || {})}, config, create);
                break;
            case "habilidade":
                rollResult = await actor.rollSkill({ skill: rollSubject, ...(advantage || {})}, config, create);
                break;
        }

        await waitForDiceSoNiceAnimation();
        
        return rollResult[0];
    }

    async processInitiativeRoll(data){
        console.log("[Galho Seco Integration] Rolagem de Iniciativa recebida via WebSocket!");
        const advantage = data.advantage
        const charId = data.charId;

        const actor = game.actors.get(charId);
        if (!actor){
            console.log("[Galho Seco Integration] Personagem não encontrado! Rolagem não executada")
            return;
        }

        async function rollInitiativeWithCombatIntegration(actor, advantage = "normal") {
            let combat = game.combat;
            if (!combat) {
                combat = await Combat.create({ scene: canvas.scene.id });
            }

            let combatant = combat.combatants.find(c => c.actor?.id === actor.id);
            if (!combatant) {
                const created = await combat.createEmbeddedDocuments("Combatant", [{
                    actorId: actor.id,
                    sceneId: canvas.scene.id
                }]);

                combatant = created[0];
            }

            let roll = await actor.getInitiativeRoll({ create: false });

            // Se precisar, ajustamos para vantagem/desvantagem
            if (advantage === "vantagem") {
                roll = new Roll(roll.formula.replace("1d20", "2d20kh"), roll.data);
            }
            else if (advantage === "desvantagem") {
                roll = new Roll(roll.formula.replace("1d20", "2d20kl"), roll.data);
            }

            roll = await roll.evaluate({ async: true });

            await roll.toMessage({
                speaker: ChatMessage.getSpeaker({ actor }),
                flavor: game.i18n.localize("DND5E.InitiativeRoll"),
                flags: { "core.initiativeRoll": true }
            });

            await combat.setInitiative(combatant.id, roll.total);

            await waitForDiceSoNiceAnimation();

            return roll;
        }

        return rollInitiativeWithCombatIntegration(actor, advantage)
    }
}

export default new ProcessRequests()