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
            case "deathSave":
                rollResult = await actor.rollDeathSave({...(advantage || {})}, config, create)
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

    async processApplyDamage(data){
        console.log("[Galho Seco Integration] Aplicação de dano recebida via WebSocket!");
        console.log(data);

        const charId = data.charId;
        const damage = Number(data.damage);

        const actor = game.actors.get(charId);
        if (!actor){
            console.log("[Galho Seco Integration] Personagem não encontrado! Aplicação não executada")
            return;
        }

        await actor.applyDamage(damage);
    }
    
    async processApplyHealTempHp(data){
        console.log("[Galho Seco Integration] Aplicação de Cura e/ou HP temporário recebida via WebSocket!");

        const charId = data.charId;
        const heal = Number(data.healData.heal);
        const tempHp = Number(data.healData.tempHp);

        const actor = game.actors.get(charId);
        if (!actor){
            console.log("[Galho Seco Integration] Personagem não encontrado! Aplicação não executada")
            return;
        }

        if (heal) await actor.applyDamage(-heal);
        if (tempHp) await actor.applyTempHP(tempHp);
    }
    
    async processHitDiceRoll(data){
        console.log("[Galho Seco Integration] Rolagem de Dado de Vida recebida via WebSocket!");

        const charId = data.charId;
        const config = data.config;
        const dialog = { configure: false }
        const create = { create: true }

        const actor = game.actors.get(charId);
        if (!actor){
            console.log("[Galho Seco Integration] Personagem não encontrado! Rolagem não executada")
            return;
        }

        const rollResult = await actor.rollHitDie(config, dialog, create);

        await waitForDiceSoNiceAnimation();

        return rollResult[0];
    }

    async processRest(data){
        console.log("[Galho Seco Integration] Descanso recebido via WebSocket!");

        const charId = data.charId;
        const config = data.config;

        const actor = game.actors.get(charId);
        if (!actor){
            console.log("[Galho Seco Integration] Personagem não encontrado! Descanso não executado")
            return;
        }

        if (data.type === 'shortRest'){
            console.log("[Galho Seco Integration] Executando Short Rest");
            await actor.shortRest(config);
        } else {
            console.log("[Galho Seco Integration] Executando Long Rest");
            delete data.autoHD;
            await actor.longRest(config);
        }
    }

    async processWeaponAttackDamage(data){
        console.log(`[Galho Seco Integration] Rolagem de ${data.type === "roll-Attack" ? "Ataque" : "Dano"} recebida via WebSocket!`);

        const charId = data.charId;
        const itemId = data.itemId;
        const config = data.config;
        const dialog = { configure: false }
        const create = { create: true }

        const actor = game.actors.get(charId);
        if (!actor){
            console.log("[Galho Seco Integration] Personagem não encontrado! Rolagem não executada")
            return;
        }
        const item = actor.items.get(itemId);
        if (!item){
            console.log("[Galho Seco Integration] Item não encontrado! Rolagem não executada")
            return;
        }

        const activities = item.system.activities.filter(a => a.type === "attack");
        if (activities.length > 0){
            const activity = activities[0];
            let rollResult;
            
            if(data.type === 'roll-Attack'){
                rollResult = await activity.rollAttack(config, dialog, create);
            } else {
                rollResult = await activity.rollDamage(config, dialog, create);
            }

            await waitForDiceSoNiceAnimation();

            return rollResult[0];
        } else {
            console.log("[Galho Seco Integration] Item não possui atividade de ataque. Rolagem não executada")
            return;
        }
    }

    async processSpellcasting(data){
        const rollType = data.type === 'cast-spell-attack' ? "Ataque de Conjuração" : "Dano de conjuração"
        console.log(`[Galho Seco Integration] Rolagem de ${rollType} recebida via WebSocket!`);

        const charId = data.charId;
        const itemId = data.itemId;
        const activityid = data.activityId;
        const atkConfig = data.atkConfig || {};
        const config = data.config;
        const dialog = { configure: false }
        const create = { create: true }
        console.log(config);

        const actor = game.actors.get(charId);
        if (!actor){
            console.log("[Galho Seco Integration] Personagem não encontrado! Rolagem não executada")
            return;
        }

        const item = actor.items.get(itemId);
        if (!item){
            console.log("[Galho Seco Integration] Item não encontrado! Rolagem não executada")
            return;
        }

        const activity = item.system.activities.get(activityid);
        if (!item){
            console.log("[Galho Seco Integration] Activity não encontrada! Rolagem não executada")
            return;
        }

        let result;
        if (data.type === 'cast-spell-damage'){
            result = await activity.rollDamage(config, dialog, create);
        } else {
            await activity.use(config, dialog, create);
            if (data.type === 'cast-spell-attack'){
                result = await activity.rollAttack(atkConfig, dialog, create);
            } else {
                result = await activity.rollDamage({scaling: config.scaling}, dialog, create);
            }
        }

        if (result) await waitForDiceSoNiceAnimation();
        return result ? result[0] : {};
    }
}

export default new ProcessRequests()