import * as dayjs from 'dayjs'

export default async function handler(req, res) {
    const { query: { lastUpdate } } = req
    const data = await import(`../../data/bips.json`)
    let bips = data.bips

    /* `lastUpdate` param */
    if (lastUpdate) {
        const lastUpdateParam = dayjs(lastUpdate)
        if (lastUpdateParam.isValid()) {
            bips = data.bips.filter(bip => dayjs(bip.LastUpdate) > lastUpdateParam)
        }
        else {
            res.status(400).json({ error: '`lastUpdate` param must be a valid date' })
            return
        }
    }

    res.status(200).json(bips)
}