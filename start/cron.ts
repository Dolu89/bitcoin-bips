import cron from 'node-cron';
import { Octokit } from '@octokit/rest'
import Env from '@ioc:Adonis/Core/Env'
import Redis from '@ioc:Adonis/Addons/Redis'

cron.schedule('0 0 * * *', async () => {
  console.log('STARTING CRON')
  try {
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

        await Redis.set(bipNumber + 'content', content)

        const title = parsedBipDetails.find(t => t[0] === 'Title')
        const titleValue = title ? title[1] : ''
        await Redis.set(bipNumber + 'title', titleValue)

        const author = parsedBipDetails.find(t => t[0] === 'Author')
        const authorValue = author ? author[1] : ''
        await Redis.set(bipNumber + 'authors', authorValue)

        const status = parsedBipDetails.find(t => t[0] === 'Status')
        const statusValue = status ? status[1] : ''
        await Redis.set(bipNumber + 'status', statusValue)

        const type = parsedBipDetails.find(t => t[0] === 'Type')
        const typeValue = type ? type[1] : ''
        await Redis.set(bipNumber + 'type', typeValue)

        const created = parsedBipDetails.find(t => t[0] === 'Created')
        const createdValue = created ? created[1] : ''
        await Redis.set(bipNumber + 'date', createdValue)

        bips = [...bips, { bip: bipNumber, title: titleValue, author: authorValue, status: statusValue, type: typeValue, created: createdValue }]
      }

    }

    await Redis.set('bips', JSON.stringify(bips))

    console.log('Ending cron')
  } catch (error) {
    console.error(error)
  }
});