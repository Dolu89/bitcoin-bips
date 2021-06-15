import Redis from '@ioc:Adonis/Addons/Redis'
import { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'

export default class BipsController {
    public async index({ response }: HttpContextContract) {
        const test = await Redis.get('bips')
        response.json(test)
    }

    public async show({ params }: HttpContextContract) {
        const { bip } = params
        const content = await Redis.get(bip + 'content')
        const title = await Redis.get(bip + 'title')
        const authors = await Redis.get(bip + 'authors')
        const status = await Redis.get(bip + 'status')
        const type = await Redis.get(bip + 'type')
        const date = await Redis.get(bip + 'date')
        return {title, authors, status, type, date, content}
    }
}
