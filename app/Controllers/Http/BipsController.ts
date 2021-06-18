import { Exception } from '@adonisjs/core/build/standalone'
import Redis from '@ioc:Adonis/Addons/Redis'
import { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import UpdateBips from 'App/Services/UpdateBips'

export default class BipsController {
    public async index({ view }: HttpContextContract) {
        const bips = await Redis.get('bips')
        if(bips === null){
            throw new Exception('BIPs are not indexed yet', 500)
        }
        return view.render('home', {bips: JSON.parse(bips)})
    }

    public async show({ params, view }: HttpContextContract) {
        const { bip } = params

        const data = await Redis.hgetall(bip)
        if (!data.title) {
            throw new Exception('BIP not found', 404)
        }

        return view.render('bip', data)
    }

    public async updateBips() {
        UpdateBips.process();
    }

    public async github({ params, response }: HttpContextContract) {
        response.redirect(`https://raw.githubusercontent.com/bitcoin/bips/master/${params['*'].join('/')}`)
    }
}
