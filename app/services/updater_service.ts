import GithubService from "#services/github_service";
import { inject } from "@adonisjs/core";
import Bip from "#models/bip";
import BipService from "#services/bip_service";
import SearchService from "#services/search_service";
import SitemapService from "#services/sitemap_service";

@inject()
export default class UpdaterService {
    constructor(private githubService: GithubService, private bipService: BipService, private searchService: SearchService, private sitemapService: SitemapService) { }

    public async updateBips() {
        const files = await this.githubService.getFilesFromRepo('bitcoin', 'bips')

        const bips: Bip[] = []
        for (const file of files) {
            try {
                if (file.path.match('^bip-([0-9]+).mediawiki$')) {
                    const bipNumber = file.path.match('[0-9]+')![0].replace(/0+/, '')

                    // Check if the current BIP needs update by checking hash file
                    const savedBip = await this.bipService.getBip(bipNumber)
                    if (savedBip?.hash === file.sha) {
                        bips.push(savedBip)
                        continue
                    }

                    console.log('Updating BIP', bipNumber)

                    // Get BIP file content
                    const content = await this.githubService.getFileContent('bitcoin', 'bips', file.path)

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

                    const htmlContentResult = await this.githubService.convertMediwikiToHtml(content)

                    if (!htmlContentResult) {
                        throw new Error('Error converting mediawiki to html')
                    }

                    const originalURL = `https://github.com/bitcoin/bips/blob/master/${file.path}`
                    const htmlContent = htmlContentResult
                        // Replace bip-0001.mediawiki url format by 1
                        .replace(/bip-(\d{1,4}).mediawiki/g, (_, bipNumber) => bipNumber)
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
                    const authors = authorValue.split(',').map((author) => {
                        return author.split('<')[0].trim()
                    })

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
                        authors: authors,
                        status: statusValue,
                        type: typeValue,
                        created: createdValue,
                        content: htmlContent,
                        contentSource: content,
                        layer: layerValue,
                        hash: file.sha,
                        updated: new Date().toISOString(),
                    }

                    bips.push(bip)
                    await this.bipService.saveBip(bip)
                }
            } catch (error) {
                console.log('Error updating bip', file.path, error)
            }
        }

        console.log(`Indexing ${bips.length} bips...`)
        await this.bipService.saveBips(bips)
        await this.searchService.init()
        await this.bipService.setLastUpdate()
        await this.sitemapService.generate()
    }
}