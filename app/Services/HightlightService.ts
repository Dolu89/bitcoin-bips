import Bip from 'App/Models/Bip'
import Fuse from 'fuse.js'

// Not used yet. Search must be more precise.
class HightlightService {
  private set(obj: object, path: string, value: any) {
    const pathValue = path.split('.')
    let i: number

    for (i = 0; i < pathValue.length - 1; i++) {
      obj = obj[pathValue[i]]
    }

    obj[pathValue[i]] = value
  }

  private generateHighlightedText(inputText: string, regions: number[] = []) {
    let content = ''
    let nextUnhighlightedRegionStartingIndex = 0

    regions.forEach((region) => {
      const lastRegionNextIndex = region[1] + 1

      content += [
        inputText.substring(nextUnhighlightedRegionStartingIndex, region[0]),
        `<span class="hightlight-search">`,
        inputText.substring(region[0], lastRegionNextIndex),
        '</span>',
      ].join('')

      nextUnhighlightedRegionStartingIndex = lastRegionNextIndex
    })

    content += inputText.substring(nextUnhighlightedRegionStartingIndex)

    return content
  }

  public highlight(fuseSearchResult: Fuse.FuseResult<Bip>[]): Fuse.FuseResult<Bip>[] {
    return fuseSearchResult
      .filter(({ matches }: any) => matches && matches.length)
      .map(({ item, matches }: any) => {
        const highlightedItem = { ...item }

        matches.forEach((match: any) => {
          this.set(
            highlightedItem,
            match.key,
            this.generateHighlightedText(match.value, match.indices)
          )
        })

        return highlightedItem
      })
  }
}

export default new HightlightService()
