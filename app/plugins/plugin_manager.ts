import { PluginContract } from '#plugins/plugin_contract'
import { inject } from '@adonisjs/core'
import BipsPlugin from '#plugins/bips/index'

@inject()
export class PluginManager {
    private plugins: PluginContract[] = []

    constructor() {
        // TODO - Load plugins from folder plugins/*
        const allPlugins = [BipsPlugin]
        this.plugins = allPlugins.filter(plugin => plugin.enable)
    }

    public async start() {
        for (const plugin of this.plugins) {
            plugin.start()
        }
    }
}