import { Exception } from '@adonisjs/core/build/standalone'
import Redis from '@ioc:Adonis/Addons/Redis'
import { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import UpdateBips from 'App/Services/UpdateBips'
import Env from '@ioc:Adonis/Core/Env'
import SearchService from 'App/Services/SearchService'
import SearchValidator from 'App/Validators/SearchValidator'
import BipService from 'App/Services/BipService'
import { string } from '@ioc:Adonis/Core/Helpers'

export default class BipsController {
  public async index({ view }: HttpContextContract) {
    const bips = await BipService.getAll()
    if (!bips || bips.length === 0) {
      throw new Exception('BIPs are not indexed yet', 500)
    }

    const updatedDate = await Redis.get('updated')

    return view.render('home', { bips: bips, updatedDate })
  }

  public async show({ params, view }: HttpContextContract) {
    const { bip } = params

    const data = await BipService.getByNumber(bip)
    if (!data.title) {
      throw new Exception('BIP not found', 404)
    }

    const updatedDate = await Redis.get('updated')

    return view.render('bip', { bip: data, updatedDate })
  }

  public async search({ request, response, view }: HttpContextContract) {
    const { q } = await request.validate(SearchValidator)
    const searchResult = (await SearchService.search(q)).map((s) => {
      const contentTruncate = string.excerpt(s.item.contentSource, 1000)
      const { content, ...item } = s.item
      item.contentSource = contentTruncate
      return item
    })

    const updatedDate = await Redis.get('updated')

    switch (request.accepts(['html', 'json'])) {
      case 'html':
        return view.render('search', { query: q, searchResult, updatedDate })
      case 'json':
        return response.json(searchResult)
      default:
        return view.render('search', { query: q, searchResult, updatedDate })
    }
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
}
