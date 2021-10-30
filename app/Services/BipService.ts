import Redis from '@ioc:Adonis/Addons/Redis'
import Bip from 'App/Models/Bip'

class BipService {
  public async initList(): Promise<void> {
    const keys = await Redis.keys('bip:*')
    const bips: Bip[] = []
    for (const key of keys) {
      const bip = await Redis.hgetall(key)
      bips.push({
        bip: bip.bip,
        authors: bip.authors,
        content: bip.content,
        contentSource: bip.contentSource,
        created: bip.created,
        layer: bip.layer,
        status: bip.status,
        title: bip.title,
        type: bip.type,
        hash: bip.hash,
        updated: bip.updated,
      })
    }
    await Redis.set(
      'bips',
      JSON.stringify(bips.sort((a: Bip, b: Bip) => Number.parseInt(a.bip) - Number.parseInt(b.bip)))
    )
  }

  public async getAll(): Promise<Bip[]> {
    let bips = await Redis.get('bips')
    if (bips === null) {
      await this.initList()
      bips = await Redis.get('bips')
    }
    return JSON.parse(bips!)
  }

  public getByNumber(bipNumber: string): Promise<Record<string, string>> {
    return Redis.hgetall('bip:' + bipNumber)
  }
}

export default new BipService()
