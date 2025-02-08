import GithubService from '#services/github_service';
import { inject } from '@adonisjs/core'
import logger from '@adonisjs/core/services/logger';
import { Job } from '@rlanz/bull-queue'
import BipService from '../services/bip_service.js';
import TypeConverterService from '#services/type_converter_service';
import { Bip } from '../models/bip.js';

interface SchedulerJobPayload { }

@inject()
export default class ScheduledrJob extends Job {

  constructor(private githubService: GithubService, private bipService: BipService, private typeConverterService: TypeConverterService) {
    super();
  }

  // This is the path to the file that is used to create the job
  static get $$filepath() {
    return import.meta.url
  }

  /**
   * Base Entry point
   */
  async handle(_: SchedulerJobPayload) {
    const files = await this.githubService.getFilesFromRepo('bitcoin', 'bips')
    const bips: Bip[] = []

    for (const file of files) {
      // Bips are written in mediawiki and markdown and the format is bip-0001.mediawiki or bip-0001.md
      const fileMatch = file.path.match('^bip-([0-9]+).(mediawiki|md)$')

      if (fileMatch) {
        const bipNumber = file.path.match('[0-9]+')![0].replace(/0+/, '')
        const format = fileMatch[2] as 'mediawiki' | 'md'

        // Check if the current BIP needs update by checking hash file
        const savedBip = await this.bipService.get(bipNumber)
        if (savedBip?.hash === file.sha) {
          bips.push(savedBip)
          continue
        }

        logger.info(`Updating BIP ${bipNumber}`)

        try {
          let markdownContent = ''
          const originalFileContent = await this.githubService.getFileContent('bitcoin', 'bips', file.path)

          // Getting head details
          const bipDetails = originalFileContent
            .substring(originalFileContent.indexOf('<pre>') + 5, originalFileContent.indexOf('</pre>'))
            .trim()
            .split('\n')

          if (format === 'mediawiki') {
            markdownContent = await this.typeConverterService.fromMediaWikiToMarkdown(originalFileContent)
          } else {
            markdownContent = originalFileContent
          }

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

          markdownContent = markdownContent
            // Replace bip-0001.mediawiki url format by 1
            .replace(/bip-(\d{1,4}).mediawiki/g, (_, bipNumber) => bipNumber)
            // set internal github link
            .replace(/\"bip-(\d{1,4})\/\S+"/g, (value, _) =>
              value.replace(`"`, `"https://raw.githubusercontent.com/bitcoin/bips/master/`)
            )

          // Set BIP properties
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
            number: bipNumber,
            title: titleValue,
            authors: authors,
            status: statusValue,
            type: typeValue,
            created: createdValue,
            content: markdownContent,
            layer: layerValue,
            hash: file.sha,
            updated: new Date().toISOString(),
          }

          // Save BIP
          await this.bipService.save(bip)
          bips.push(bip)

        } catch (error) {
          logger.error(`Error processing file ${file.path}: ${error}`)
        }
      }
    }

    logger.info(`Indexing ${bips.length} bips...`)
    await this.bipService.saveAll(bips).catch((error) => {
      console.log('Error saving all bips', error)
    })
  }

  /**
   * This is an optional method that gets called when the retries has exceeded and is marked failed.
   */
  async rescue(_: SchedulerJobPayload) { }
}