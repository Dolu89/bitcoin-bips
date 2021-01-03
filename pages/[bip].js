import Head from 'next/head'
import { Markdown } from "@cenguidanos/node-markdown-parser"
import util from "util"
import { readFile } from 'fs'
import path from 'path'
import getConfig from 'next/config'
const { serverRuntimeConfig } = getConfig()
import Utils from '../utils/utils.js'
import AnchorJS from 'anchor-js'
import React, { useEffect } from "react"



const Bip = (props) => {
    useEffect(() => {
        const anchors = new AnchorJS()
        anchors.add()
    }, [])

    return (
        <>
            <Head>
                <title>{props.title}</title>
                <meta property="og:title" content={props.title} key="title" />
                <meta property="og:description" content={`Read more about the BIP${props.bipNumber} on bips.xyz`} key="description" />
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
    const originalURL = `https://github.com/bitcoin/bips/blob/master/${bipFile}.mediawiki`

    const content = data.body
        // Replace bip-0001.mediawiki url format by 1
        .replace(/bip-(\d{1,4}).mediawiki/g, (_, bipNumber) => parseInt(bipNumber))
        // link to original BIP file in preamble
        .replace(/  BIP: \d{1,4}/, (_) => _ + ` <small><a href="${originalURL}" target="_blank">source</a></small>`)
    return {
        props: {
            bipNumber: params.bip,
            title,
            content
        }
    }
}


export default Bip