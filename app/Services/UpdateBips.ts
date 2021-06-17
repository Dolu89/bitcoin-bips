import { Octokit } from '@octokit/rest'
import Env from '@ioc:Adonis/Core/Env'
import Redis from '@ioc:Adonis/Addons/Redis'
import axios from 'axios';

class UpdateBips {
    public async process() {
        try {
            console.log('Update bips start')

            const octokit = new Octokit({
                auth: Env.get('GITHUB_TOKEN'),
            })

            const files = await octokit.repos.getContent({ owner: 'bitcoin', repo: 'bips', path: '' })
            let bips: { bip: string, title: string, author: string, status: string, type: string, created: string }[] = []

            for (let index = 0; index < (<[]>files.data).length; index++) {
                const file: { name: string, sha: string } = files.data[index];

                if (file.name.match('^bip-([0-9]+)\.mediawiki$')) {
                    const blobResult = await octokit.git.getBlob({ owner: 'bitcoin', repo: 'bips', file_sha: file.sha })
                    const buff = Buffer.from(blobResult.data.content, 'base64')
                    const content = buff.toString('utf-8')

                    const bipNumber = file.name.match('[0-9]+')![0].replace(/0+/, '')

                    const bipDetails = content.substring(content.indexOf('<pre>') + 5, content.indexOf('</pre>')).trim().split('\n')
                    let parsedBipDetails: string[][] = []

                    for (let index = 0; index < bipDetails.length; index++) {
                        const element = bipDetails[index];

                        if (element.indexOf(': ') !== -1) {
                            parsedBipDetails = [...parsedBipDetails, element.split(': ').map(t => t.trim())]
                        }
                        else {
                            let t = parsedBipDetails[parsedBipDetails.length - 1]
                            t[1] = `${t[1]}, ${element.trim()}`
                            parsedBipDetails = [...parsedBipDetails, t]
                        }
                    }

                    parsedBipDetails = [...new Set(parsedBipDetails)]

                    // Transform mediawiki to html using https://github.com/dolu89/gm-to-html
                    const htmlContentResult = await axios.post(`${Env.get('GM2HTML_URL')}/api/v1/render`, { content, markup: 'mediawiki' })

                    const originalURL = `https://github.com/bitcoin/bips/blob/master/${file.name}`
                    const htmlContent = htmlContentResult.data
                        // Replace bip-0001.mediawiki url format by 1
                        .replace(/bip-(\d{1,4}).mediawiki/g, (_, bipNumber) => parseInt(bipNumber))
                        // link to original BIP file in preamble
                        .replace(/  BIP: \d{1,4}/, (_) => _ + ` <small><a href="${originalURL}" target="_blank">source</a></small>`)

                    const title = parsedBipDetails.find(t => t[0] === 'Title')
                    const titleValue = title ? title[1] : ''

                    const author = parsedBipDetails.find(t => t[0] === 'Author')
                    const authorValue = author ? author[1] : ''

                    const status = parsedBipDetails.find(t => t[0] === 'Status')
                    const statusValue = status ? status[1] : ''

                    const type = parsedBipDetails.find(t => t[0] === 'Type')
                    const typeValue = type ? type[1] : ''

                    const created = parsedBipDetails.find(t => t[0] === 'Created')
                    const createdValue = created ? created[1] : ''

                    await Redis.hset(bipNumber, [{
                        title: titleValue,
                        author: authorValue,
                        status: statusValue,
                        type: typeValue,
                        created: createdValue,
                        content: htmlContent
                    }])

                    bips = [...bips, { bip: bipNumber, title: titleValue, author: authorValue, status: statusValue, type: typeValue, created: createdValue }]
                }

            }

            await Redis.set('bips', JSON.stringify(bips))
            console.log('Update bips end')

        } catch (error) {
            console.error(error)
        }
    }
}

export default new UpdateBips()