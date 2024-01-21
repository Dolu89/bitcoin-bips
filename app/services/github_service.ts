import { request } from 'undici'
import { Octokit } from '@octokit/rest'
import * as cheerio from 'cheerio'
import GithubFile from '#models/github_file'
import env from '#start/env'

export default class GithubService {
  constructor() {}

  public async convertMediwikiToHtml(content: string) {
    const ghApiKey = env.get('GITHUB_API_KEY')
    if (!ghApiKey) throw new Error('Github API key not found')

    // Github API login
    const octokit = new Octokit({
      auth: ghApiKey,
    })

    // Gist creation
    const fileName = `tmp-bips.mediawiki`
    const gistCreationResult = await octokit.gists.create({
      public: false,
      files: { [fileName]: { content: content } },
    })

    // Getting gist data (raw html, css link, ...)
    const gistJson = await request(`${gistCreationResult.data.html_url!}.json`)
    const body = (await gistJson.body.json()) as { div: string }
    const html = body.div

    // Delete the gist
    octokit.gists.delete({ gist_id: gistCreationResult.data.id! }).catch((err) => {
      console.log('Error deleting gist', err)
    })

    const $ = cheerio.load(html)

    // Remove Github stuff
    $('.gist-meta').remove()

    return $('div').first().html()
  }

  public async getFilesFromRepo(
    owner: string,
    repo: string,
    branch: string = 'master'
  ): Promise<{ path: string; sha: string }[]> {
    const { statusCode, body } = await request(
      `https://ungh.cc/repos/${owner}/${repo}/files/${branch}`
    )

    if (statusCode !== 200) {
      throw new Error('Error getting files from repo')
    }

    return ((await body.json()) as GithubFile).files.map((file) => {
      return {
        path: file.path,
        sha: file.sha,
      }
    })
  }

  public async getFileContent(
    owner: string,
    repo: string,
    path: string,
    branch: string = 'master'
  ): Promise<string> {
    const { statusCode, body } = await request(
      `https://ungh.cc/repos/${owner}/${repo}/files/${branch}/${path}`
    )

    if (statusCode !== 200) {
      throw new Error('Error getting file content')
    }

    return JSON.parse(await body.text()).file.contents
  }
}
