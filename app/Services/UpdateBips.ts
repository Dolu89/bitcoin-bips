import { Octokit } from '@octokit/rest'
import Env from '@ioc:Adonis/Core/Env'
import Redis from '@ioc:Adonis/Addons/Redis'
import axios from 'axios'
import Bip from 'App/Models/Bip'
import BipList from 'App/Models/BipList'
import SearchService from './SearchService'
import SitemapService from './SitemapService'

class UpdateBips {
  public async process() {
    try {
      console.log('Update bips start')

      const octokit = new Octokit({
        auth: Env.get('GITHUB_TOKEN'),
      })

      const files = await octokit.repos.getContent({ owner: 'bitcoin', repo: 'bips', path: '' })
      let bips: BipList[] = []

      for (let index = 0; index < (<[]>files.data).length; index++) {
        let bipNumber: string = ''
        try {
          const file: { name: string; sha: string } = files.data[index]

          // Check if the file is BIP
          if (file.name.match('^bip-([0-9]+).mediawiki$')) {
            bipNumber = file.name.match('[0-9]+')![0].replace(/0+/, '')

            // Check if the current BIP needs update by checking hash file
            const savedBip = await Redis.hgetall('bip:' + bipNumber)
            if (savedBip && savedBip.hash === file.sha) {
              continue
            }

            console.log(`Updating BIP ${bipNumber}`)

            // Get BIP file content
            const blobResult = await octokit.git.getBlob({
              owner: 'bitcoin',
              repo: 'bips',
              file_sha: file.sha,
            })
            const buff = Buffer.from(blobResult.data.content, 'base64')
            const content = buff.toString('utf-8')

            // Getting head details
            const bipDetails = content
              .substring(content.indexOf('<pre>') + 5, content.indexOf('</pre>'))
              .trim()
              .split('\n')
            let parsedBipDetails: string[][] = []

            for (let index = 0; index < bipDetails.length; index++) {
              const element = bipDetails[index]

              if (element.indexOf(': ') !== -1) {
                parsedBipDetails = [...parsedBipDetails, element.split(': ').map((t) => t.trim())]
              } else {
                let t = parsedBipDetails[parsedBipDetails.length - 1]
                t[1] = `${t[1]}, ${element.trim()}`
                parsedBipDetails = [...parsedBipDetails, t]
              }
            }

            parsedBipDetails = [...new Set(parsedBipDetails)]

            // Transform mediawiki to html using https://github.com/dolu89/gm-to-html
            const htmlContentResult = await axios.post(`${Env.get('GM2HTML_URL')}/api/v1/render`, {
              content,
              markup: 'mediawiki',
            })

            const originalURL = `https://github.com/bitcoin/bips/blob/master/${file.name}`
            const htmlContent = htmlContentResult.data
              // Replace bip-0001.mediawiki url format by 1
              .replace(/bip-(\d{1,4}).mediawiki/g, (_, bipNumber) => parseInt(bipNumber))
              // link to original BIP file in preamble
              .replace(
                / {2}BIP: \d{1,4}/,
                (_) =>
                  _ +
                  ` <span class="source"><a href="${originalURL}" rel="noreferrer" target="_blank">source</a></span>`
              )
              // remove "user-content-" from ids
              .replaceAll('id="user-content-', 'id="')
              // replace Table of contents _ by - and to lower
              .replace(/href=\"#\S+\"/g, (value, _) => value.toLowerCase().replaceAll('_', '-'))
              // set internal github link
              .replace(/\"bip-(\d{1,4})\/\S+"/g, (value, _) =>
                value.replace(`"`, `"https://raw.githubusercontent.com/bitcoin/bips/master/`)
              )

            const title = parsedBipDetails.find((t) => t[0] === 'Title')
            const titleValue = title ? title[1] : ''

            const author = parsedBipDetails.find((t) => t[0] === 'Author')
            const authorValue = author ? author[1] : ''

            const status = parsedBipDetails.find((t) => t[0] === 'Status')
            const statusValue = status ? status[1] : ''

            const type = parsedBipDetails.find((t) => t[0] === 'Type')
            const typeValue = type ? type[1] : ''

            const layer = parsedBipDetails.find((t) => t[0] === 'Layer')
            const layerValue = layer ? layer[1] : ''

            const created = parsedBipDetails.find((t) => t[0] === 'Created')
            const createdValue = created ? created[1] : ''

            const bip: Bip = {
              bip: bipNumber,
              title: titleValue,
              authors: authorValue,
              status: statusValue,
              type: typeValue,
              created: createdValue,
              content: htmlContent,
              contentSource: content,
              layer: layerValue,
              hash: file.sha,
              updated: new Date().toISOString(),
            }
            await Redis.hset('bip:' + bipNumber, [bip])

            bips.push({
              bip: bipNumber,
              title: titleValue,
              authors: authorValue,
              status: statusValue,
              type: typeValue,
              created: createdValue,
              layer: layerValue,
              hash: file.sha,
              updated: new Date().toISOString(),
            })

            console.log(`BIP ${bipNumber} updated`)
          }
        } catch (error) {
          if (bipNumber !== '') {
            const data = await Redis.hgetall('bip:' + bipNumber)
            if (data.bip) {
              bips.push({
                bip: data.bip,
                title: data.title,
                authors: data.authors,
                status: data.status,
                type: data.type,
                created: data.created,
                layer: data.layer,
                hash: data.hash,
                updated: data.updated || new Date().toISOString(),
              })
            }
          }
          console.error(error)
        }
      }

      await Redis.set('bips', JSON.stringify(bips))
      const date = new Date()
      await Redis.set(
        'updated',
        `${date.getUTCFullYear()}-${date.getUTCMonth() + 1}-${date.getUTCDate()}`
      )
      SearchService.init()
      SitemapService.generate()
      console.log('Update bips end')
    } catch (error) {
      console.error(error)
    }
  }
}

export default new UpdateBips()
