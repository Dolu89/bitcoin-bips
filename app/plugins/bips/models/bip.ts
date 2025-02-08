import StoreContract from "#models/contracts/store"

export class Bip implements StoreContract {
    number: string
    title: string
    authors: string[]
    status: string
    type: string
    created: string
    content: string
    layer: string
    hash: string
    updated: string

    constructor(number: string, title: string, authors: string[], status: string, type: string, created: string, content: string, layer: string, hash: string, updated: string) {
        this.number = number
        this.title = title
        this.authors = authors
        this.status = status
        this.type = type
        this.created = created
        this.content = content
        this.layer = layer
        this.hash = hash
        this.updated = updated
    }
}