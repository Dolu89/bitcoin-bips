import { request } from 'undici'
import GithubFile from './types/github_type.js';

export default class GithubService {
    constructor() { }

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