import { readFile } from 'fs'
import util from "util"
import path from 'path'
import getConfig from 'next/config'
const { serverRuntimeConfig } = getConfig()


export default async function handler(req, res) {
    const readFileAsync = util.promisify(readFile)
    let file = await readFileAsync(path.join(serverRuntimeConfig.PROJECT_ROOT, `./test/bip-0001.md`), "utf-8");
    
    console.log(file)
    res.statusCode = 200
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ content: file }))
}