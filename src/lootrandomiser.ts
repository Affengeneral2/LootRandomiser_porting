import { DependencyContainer } from "tsyringe"
import type { ILogger } from "@spt/models/spt/utils/ILogger"
import type { IPostDBLoadMod } from "@spt/models/external/IPostDBLoadMod"
import type { DatabaseServer } from "@spt/servers/DatabaseServer"

class LootRandomiser implements IPostDBLoadMod {
    private container: DependencyContainer
    private config = require("../config/config.json")

    public hasProps(item: string | number) {
        const database = this.container.resolve<DatabaseServer>("DatabaseServer").getTables()
        const items = database.templates.items
        if (items[item] != undefined && items[item]._props != undefined && Object.entries(items[item]._props).length > 5) {
            return true
        }
        else {
            return false
        }
    }

    public logif(logger: ILogger, message: string, color: string) {
        if (this.config.console_spam === true) {
            logger = this.container.resolve<ILogger>("WinstonLogger")
            logger.log("[Loot Randomiser] " + message, color)
        }
    }

    public postDBLoad(container: DependencyContainer): void {
        debugger
        this.container = container
        const logger = this.container.resolve<ILogger>("WinstonLogger")
        const tbls = container.resolve<DatabaseServer>("DatabaseServer").getTables()
        const idb = tbls.templates.items
        const hdb = tbls.templates.handbook.Items
        const excludeID = this.config.loot_exclude_by_id
        const excludeParent = this.config.loot_exclude_by_parent_id
        const lootRatesbyParent = this.config.loot_rate_by_parents
        const lootRates = this.config.loot_rate
        const sizemult = this.config.loot_size_multiplier
        if (this.config.enabled === true) {
            const lootList = []
            for (const iter in hdb) {
                const item = hdb[iter].Id
                if (this.hasProps(item) === true) {
                    if (idb[item]?._props?.Prefab?.path === "") {
                        this.logif(logger, "Excluding " + item + " : Has no prefab", "red")
                        continue
                    }
                    if (idb[item]?._props?.QuestItem === true && this.config.quest_items !== true) {
                        this.logif(logger, "Excluding " + item + " : Quest-only items disabled by config", "yellow")
                        continue
                    }
                    if (sizemult !== 1) {
                        const oldx = idb[item]._props.Width
                        const oldy = idb[item]._props.Height
                        const oldsizeaddu = idb[item]._props.ExtraSizeUp
                        const oldsizeaddd = idb[item]._props.ExtraSizeDown
                        const oldsizeaddl = idb[item]._props.ExtraSizeLeft
                        const oldsizeaddr = idb[item]._props.ExtraSizeRight
                        idb[item]._props.Width = Math.max(1, Math.round(oldx * sizemult))
                        idb[item]._props.Height = Math.max(1, Math.round(oldy * sizemult))
                        idb[item]._props.ExtraSizeUp = Math.max(0, Math.round(oldsizeaddu * sizemult))
                        idb[item]._props.ExtraSizeDown = Math.max(0, Math.round(oldsizeaddd * sizemult))
                        idb[item]._props.ExtraSizeLeft = Math.max(0, Math.round(oldsizeaddl * sizemult))
                        idb[item]._props.ExtraSizeRight = Math.max(0, Math.round(oldsizeaddr * sizemult))
                    }
                    if (excludeID.indexOf(item) !== -1) {
                        this.logif(logger, "Excluding " + item + " : Excluded by config", "yellow")
                        continue
                    }
                    const parent = idb[item]?._parent
                    if (excludeParent.indexOf(parent) !== -1) {
                        this.logif(logger, "Excluding " + item + " : Parent is excluded by config (" + parent + ")", "yellow")
                        continue
                    }
                    let rate = 1
                    if (lootRates[item] !== undefined) {
                        if (lootRates[item] > 0) {
                            rate = Math.ceil(lootRates[item])
                        }
                        else {
                            this.logif(logger, "Excluding " + item + " : Spawn rate is zero or less", "yellow")
                            continue
                        }
                    }
                    else if (lootRatesbyParent[parent] !== undefined) {
                        if (lootRatesbyParent[parent] > 0) {
                            rate = Math.ceil(lootRatesbyParent[parent])
                        }
                        else {
                            this.logif(logger, "Excluding " + item + " : Spawn rate of parent (" + parent + ") is zero or less", "yellow")
                            continue
                        }
                    }
                    this.logif(logger, "Including " + item + " : Spawn rate x" + rate, "green")
                    lootList.push({ tpl: item, relativeProbability: rate })
                }
            }

            for (const [locationName, locationData] of Object.entries(tbls.locations)) {
                this.logif(logger, "Modifying Staticloot for " + locationName + ":", "green")
                const ldb = locationData.staticLoot
                for (const id in ldb) {
                    this.logif(logger, "Patching " + id, "cyan")
                    ldb[id].itemDistribution = lootList
                    if (this.config.loot_quantity_distributions.length > 0) {
                        ldb[id].itemcountDistribution = this.config.loot_quantity_distributions
                    }
                }
            }
            logger.log("[Loot Randomiser] Loot has been patched, have fun with RNJesus!", "green")
        }
        else {
            logger.log("[Loot Randomiser] Loot patch have been turned off, so the mod will not run.", "red")
        }
    }
}

module.exports = { mod: new LootRandomiser() }