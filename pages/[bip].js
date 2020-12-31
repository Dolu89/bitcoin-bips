import Head from 'next/head'
import { Markdown } from "@cenguidanos/node-markdown-parser";
import util from "util"
import { readFile } from 'fs'
import path from 'path'
import getConfig from 'next/config'
const { serverRuntimeConfig } = getConfig()
import Utils from '../utils/utils.js'

const Bip = (props) => {
    return (
        <>
            <Head>
                <title>{props.title}</title>
            </Head>
            <div
                dangerouslySetInnerHTML={{
                    __html: props.content
                }}>
            </div>
        </>
    )
}

export async function getStaticPaths() {
    const data = await import(`../data/bips.json`)
    const paths = data.bips.filter(bip => bip.Status != 'BIP number allocated').map(bip => { return { params: { bip: bip.Number } } })
    return {
        paths,
        fallback: false
    }
}

export async function getStaticProps({ params }) {
    const bipFile = Utils.FormatBipAsFile(params.bip)
    const readFileAsync = util.promisify(readFile)
    let markdown = new Markdown({})
    let file = await readFileAsync(path.join(serverRuntimeConfig.PROJECT_ROOT, `./public/${bipFile}.md`), "utf-8")
    let data = markdown.toJSON(file)
    if (!data.body) throw new Error(`Failed to parse markdown page for ${bipFile}.md`)
    const title = `BIP${(params.bip)} - ${file.substring(file.indexOf('Title: ') + 7, file.indexOf('Author: '))}`
    return {
        props: {
            title,
            content: data.body
        }
    }
}


export default Bip