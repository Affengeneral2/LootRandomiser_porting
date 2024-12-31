// University of Illinois/NCSA Open Source License

// Copyright (c) [year] [fullname]. All rights reserved.

// Developed by: [Loot Randomizer 3.10 Port]
//               [Affengeneral]
//               [projecturl]

// Permission is hereby granted, free of charge, to any person
// obtaining a copy of this software and associated documentation files
// (the "Software"), to deal with the Software without restriction,
// including without limitation the rights to use, copy, modify, merge,
// publish, distribute, sublicense, and/or sell copies of the Software,
// and to permit persons to whom the Software is furnished to do so,
// subject to the following conditions:

// * Redistributions of source code must retain the above copyright notice,
//   this list of conditions and the following disclaimers.

// * Redistributions in binary form must reproduce the above copyright
//   notice, this list of conditions and the following disclaimers in the
//   documentation and/or other materials provided with the distribution.

// * Neither the names of [fullname], [project] nor the names of its
//   contributors may be used to endorse or promote products derived from
//   this Software without specific prior written permission.

// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// CONTRIBUTORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS WITH
// THE SOFTWARE.

import { DependencyContainer } from "tsyringe"
import type { ILogger } from "@spt/models/spt/utils/ILogger"
import type { IPostDBLoadMod } from "@spt/models/external/IPostDBLoadMod"
import type { DatabaseServer } from "@spt/servers/DatabaseServer"

class LootRandomiser implements IPostDBLoadMod
{
    private container: DependencyContainer
    private config = require("../config/config.json")
  
    public hasProps(item: string | number) 
    {
        const database = this.container.resolve<DatabaseServer>("DatabaseServer").getTables()
        const items = database.templates.items
        if (items[item] != undefined && items[item]._props != undefined && Object.entries(items[item]._props).length > 5) 
        {
            return true
        }
        else 
        {
            return false
        }
    }
   
    public logif(logger : ILogger, message: string, color: string) 
    {
        if (this.config.console_spam === true) 
        {
            logger = this.container.resolve<ILogger>("WinstonLogger")
            logger.log("[Loot Randomiser] " + message, color)
        }
    }

    public postDBLoad(container: DependencyContainer):void
    {
        this.container = container
        const logger = this.container.resolve<ILogger>("WinstonLogger")
        const tbls = container.resolve<DatabaseServer>("DatabaseServer").getTables()
        // const ldb = tbls.loot.staticLoot
        const idb = tbls.templates.items
        const hdb = tbls.templates.handbook.Items
        const excludeID = this.config.loot_exclude_by_id
        const excludeParent = this.config.loot_exclude_by_parent_id
        const lootRatesbyParent = this.config.loot_rate_by_parents
        const lootRates = this.config.loot_rate
        const sizemult = this.config.loot_size_multiplier
        const csizemult = this.config.container_size_multiplier
        if (this.config.enabled === true) 
        {
            const lootList = []
            for (const iter in hdb) 
            {
                const item = hdb[iter].Id
                if (this.hasProps(item) === true) 
                {
                    if (idb[item]?._props?.Prefab?.path === "") 
                    {
                        this.logif(logger, "Excluding " + item + " : Has no prefab", "red")
                        continue
                    }
                    if (idb[item]?._props?.QuestItem === true && this.config.quest_items !== true) 
                    {
                        this.logif(logger, "Excluding " + item + " : Quest-only items disabled by config", "yellow")
                        continue
                    }
                    if (sizemult !== 1)
                    {
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
                    if (excludeID.indexOf(item) !== -1) 
                    {
                        this.logif(logger, "Excluding " + item + " : Excluded by config", "yellow")
                        continue
                    }
                    const parent = idb[item]?._parent
                    if (excludeParent.indexOf(parent) !== -1) 
                    {
                        this.logif(logger, "Excluding " + item + " : Parent is excluded by config (" + parent + ")", "yellow")
                        continue
                    }
                    let rate = 1
                    if (lootRates[item] !== undefined) 
                    {
                        if (lootRates[item] > 0) 
                        {
                            rate = Math.ceil(lootRates[item])
                        }
                        else 
                        {
                            this.logif(logger, "Excluding " + item + " : Spawn rate is zero or less", "yellow")
                            continue
                        }
                    }
                    else if (lootRatesbyParent[parent] !== undefined) 
                    {
                        if (lootRatesbyParent[parent] > 0) 
                        {
                            rate = Math.ceil(lootRatesbyParent[parent])
                        }
                        else 
                        {
                            this.logif(logger, "Excluding " + item + " : Spawn rate of parent (" + parent + ") is zero or less", "yellow")
                            continue
                        }
                    }
                    this.logif(logger, "Including " + item + " : Spawn rate x" + rate, "green")
                    lootList.push({tpl: item, relativeProbability: rate})
                }	
            }
            if (this.config.loot_static === true) 
            {
                for (const [locationName, locationData] of Object.entries(tbls.locations))
                {                    
                    this.logif(logger, "Modifying Staticloot for " + locationName + ":", "green")
                    const ldb = locationData.staticLoot
                    for (const id in ldb) 
                    {
                        this.logif(logger, "Patching " + id, "cyan")
                        ldb[id].itemDistribution = lootList
                        if (this.hasProps(id) === true && csizemult !== 1) 
                        {
                            if (idb[id] !== undefined)
                            {
                                const oldh = idb[id]._props.Grids[0]._props.cellsH
                                const oldv = idb[id]._props.Grids[0]._props.cellsV
                                idb[id]._props.Grids[0]._props.cellsH = Math.max(1, Math.round(oldh * csizemult))
                                idb[id]._props.Grids[0]._props.cellsV = Math.max(1, Math.round(oldv * csizemult))
                            }
                        }
                        if (this.config.loot_quantity_distributions.length > 0) 
                        {
                            ldb[id].itemcountDistribution = this.config.loot_quantity_distributions
                        }
                    }
                }
            }
            // =THIS CODE IS CURRENTLY BROKEN, DO NOT USE=
            /* this.logif("Patching loose loot, limit: " + limit, "cyan")
			if (this.config.loot_loose === true) {
				for (let id in customs) {
					if (id > limit)
						break
					this.logif("Patching Customs : #" + id, "cyan")
					customs[id].itemDistribution = lootList
				}
				for (let id in factory) {
					if (id > limit)
						break
					this.logif("Patching Factory (Day) : #" + id, "cyan")
					factory[id].itemDistribution = lootList
				}
				for (let id in factory_night) {
					if (id > limit)
						break
					this.logif("Patching Factory (Night) : #" + id, "cyan")
					factory_night[id].itemDistribution = lootList
				}
				for (let id in mall) {
					if (id > limit)
						break
					this.logif("Patching Interchange : #" + id, "cyan")
					mall[id].itemDistribution = lootList
				}
				for (let id in lab) {
					if (id > limit)
						break
					this.logif("Patching Laboratory : #" + id, "cyan")
					lab[id].itemDistribution = lootList
				}
				for (let id in lh) {
					if (id > limit)
						break
					this.logif("Patching Lighthouse : #" + id, "cyan")
					lh[id].itemDistribution = lootList
				}
				for (let id in res) {
					if (id > limit)
						break
					this.logif("Patching Reserve : #" + id, "cyan")
					res[id].itemDistribution = lootList
				}
				for (let id in sh) {
					if (id > limit)
						break
					this.logif("Patching Shoreline : #" + id, "cyan")
					sh[id].itemDistribution = lootList
				}
				for (let id in wood) {
					if (id > limit)
						break
					this.logif("Patching Woods : #" + id, "cyan")
					wood[id].itemDistribution = lootList
				}
				for (let id in streets) {
					if (id > limit)
						break
					this.logif("Patching Streets : #" + id, "cyan")
					streets[id].itemDistribution = lootList
				}
			} */
            logger.log("[Loot Randomiser] Loot has been patched, have fun with RNJesus!", "green")
        }
        else 
        {
            logger.log("[Loot Randomiser] Loot patch have been turned off, so the mod will not run.", "red")
        }
    }
}

module.exports = {mod: new LootRandomiser()}