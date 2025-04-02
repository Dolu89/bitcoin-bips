import GithubService from '#services/github_service'
import { inject } from '@adonisjs/core'
import Bip from '#models/bip'
import BipService from '#services/bip_service'
import SearchService from '#services/search_service'
import SitemapService from '#services/sitemap_service'
import NipService from '#services/nip_service'
import { MarkdownFile } from '@dimerapp/markdown'
import { toHtml } from '@dimerapp/markdown/utils'
import * as cheerio from 'cheerio'
import Nip from '#models/nip'
import { Shiki, codeblocks } from '@dimerapp/shiki'

@inject()
export default class UpdaterService {
  constructor(
    private githubService: GithubService,
    private bipService: BipService,
    private searchService: SearchService,
    private sitemapService: SitemapService,
    private nipService: NipService
  ) { }

  public async updateBips() {
    const files = await this.githubService.getFilesFromRepo('bitcoin', 'bips')

    const bips: Bip[] = []
    for (const file of files) {
      try {
        const bipMatch = file.path.match('^bip-([0-9]+).(mediawiki|md)$')
        if (bipMatch) {
          const bipNumber = file.path.match('[0-9]+')![0].replace(/0+/, '')
          const format = bipMatch[2] as 'mediawiki' | 'md'

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

          const htmlContentResult = await this.githubService.convertToHtml(content, format)

          if (!htmlContentResult) {
            console.error('Error converting mediawiki to html')
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

          const contentTextOnly = cheerio.load(htmlContent).text()

          const bip: Bip = {
            bip: bipNumber,
            title: titleValue,
            authors: authors,
            status: statusValue,
            type: typeValue,
            created: createdValue,
            content: htmlContent,
            contentTextOnly,
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
    await this.bipService.saveBips(bips).catch((error) => {
      console.log('Error saving bips', error)
    })

    console.log('Updating search index...')
    await this.searchService.initBips().catch((error) => {
      console.log('Error updating search index', error)
    })

    console.log('Updating last update date...')
    await this.bipService.setLastUpdate().catch((error) => {
      console.log('Error updating last update date', error)
    })

    console.log('Updating sitemap...')
    await this.sitemapService.generate().catch((error) => {
      console.log('Error updating sitemap', error)
    })
  }

  private replaceNipsLinks(htmlContent: string) {
    // Replace 01.md url format by 1
    return htmlContent
      .replace(/0*([0-9a-fA-F]{1,4}).md/g, (_, nipNumber) => nipNumber)
  }
  public async updateNips() {
    const files = await this.githubService.getFilesFromRepo('nostr-protocol', 'nips')

    const nips: Nip[] = []
    for (const file of files) {
      try {
        if (file.path.toLowerCase() === 'readme.md') {
          const content = await this.githubService.getFileContent('nostr-protocol', 'nips', file.path)

          const md = new MarkdownFile(content, { generateToc: true })
          await md.process()

          const { contents } = toHtml(md)

          const $ = cheerio.load(contents)
          $('h2#contributors').remove()
          $('h1').first().remove()

          const htmlContent = this.replaceNipsLinks($.html())

          await this.nipService.setHomePage(htmlContent)
        }
        else if (file.path.match('^([0-9a-fA-F]+).md$')) {
          const nipNumber = file.path.match('[0-9a-fA-F]+')![0].replace(/^0+/, '')

          // Check if the current BIP needs update by checking hash file
          const savedNip = await this.nipService.getNip(nipNumber)
          if (savedNip?.hash === file.sha) {
            nips.push(savedNip)
            continue
          }

          console.log('Updating NIP', nipNumber)

          // Get BIP file content
          const content = await this.githubService.getFileContent('nostr-protocol', 'nips', file.path)
          const md = new MarkdownFile(content, { generateToc: true })

          // Codeblock theme transformer
          const shiki = new Shiki()
          shiki.useTheme('one-dark-pro')
          await shiki.boot()
          md.transform(codeblocks, shiki)

          await md.process()

          const { contents, toc } = toHtml(md)

          const $ = cheerio.load(contents)
          const title = $('h2').first().text()
          const nipTitle = $('h1').first().text()
          const fullTitle = `${nipTitle} - ${title}`
          $('h1').first().remove()

          const htmlContent = this.replaceNipsLinks($.html())

          const nip: Nip = {
            nip: nipNumber,
            title: fullTitle,
            toc,
            content: htmlContent,
            contentTextOnly: $.text(),
            hash: file.sha,
            updated: new Date().toISOString(),
          }

          nips.push(nip)
          await this.nipService.saveNip(nip)
        }
      } catch (error) {
        console.log('Error updating bip', file.path, error)
      }
    }

    console.log(`Indexing ${nips.length} nips...`)
    await this.nipService.saveNips(nips).catch((error) => {
      console.log('Error saving bips', error)
    })

    console.log('Updating search index...')
    await this.searchService.initNips().catch((error) => {
      console.log('Error updating search index', error)
    })

    console.log('Updating last update date...')
    await this.nipService.setLastUpdate().catch((error) => {
      console.log('Error updating last update date', error)
    })

    // console.log('Updating sitemap...')
    // await this.sitemapService.generate().catch((error) => {
    //   console.log('Error updating sitemap', error)
    // })
  }
}
