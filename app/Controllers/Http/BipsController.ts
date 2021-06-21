import { Exception } from '@adonisjs/core/build/standalone'
import Redis from '@ioc:Adonis/Addons/Redis'
import { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import UpdateBips from 'App/Services/UpdateBips'
import Env from '@ioc:Adonis/Core/Env'

export default class BipsController {
  public async index({ view }: HttpContextContract) {
    const bips = await Redis.get('bips')
    if (bips === null) {
      throw new Exception('BIPs are not indexed yet', 500)
    }

    const updatedDate = await Redis.get('updated')

    return view.render('home', { bips: JSON.parse(bips), updatedDate })
  }

  public async show({ params, view }: HttpContextContract) {
    const { bip } = params

    const data = await Redis.hgetall(bip)
    if (!data.title) {
      throw new Exception('BIP not found', 404)
    }

    const updatedDate = await Redis.get('updated')

    return view.render('bip', { bip: data, updatedDate })
  }

  public async updateBips({ request, response }: HttpContextContract) {
    if (Env.get('NODE_ENV') !== 'production') {
      UpdateBips.process()
      return
    }

    const { updateKey } = request.qs()
    if (updateKey !== Env.get('UPDATE_KEY')) {
      return response.unauthorized()
    }

    UpdateBips.process()
  }

  public async github({ params, response }: HttpContextContract) {
    response.redirect(
      `https://raw.githubusercontent.com/bitcoin/bips/master/${params['*'].join('/')}`
    )
  }
}
