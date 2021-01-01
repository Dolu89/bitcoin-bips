import Link from 'next/link'

const Home = props => {
  return (
    <>
      <p>People wishing to submit BIPs, first should propose their idea or document to the <a href="https://lists.linuxfoundation.org/mailman/listinfo/bitcoin-dev">bitcoin-dev@lists.linuxfoundation.org</a> mailing list. After discussion, please open a PR. After copy-editing and acceptance, it will be published here.</p>
      <p>We are fairly liberal with approving BIPs, and try not to be too involved in decision making on behalf of the community. The exception is in very rare cases of dispute resolution when a decision is contentious and cannot be agreed upon. In those cases, the conservative option will always be preferred.</p>
      <p>Having a BIP here does not make it a formally accepted standard until its status becomes Final or Active.</p>
      <p>Those proposing changes should consider that ultimately consent may rest with the consensus of the Bitcoin users (see also: <a href="https://en.bitcoin.it/wiki/Economic_majority">economic majority</a>).</p>
      <table>
        <thead>
          <tr>
            <th>Number</th>
            <th>Layer</th>
            <th>Title</th>
            <th>Owner</th>
            <th>Type</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {
            props.bips.map(bip => {
              if (bip.Status == 'BIP number allocated') {
                return (
                  <tr key={bip.Number}>
                    <td>{bip.Number}</td>
                    <td>{bip.Layer}</td>
                    <td>{bip.Title}</td>
                    <td>{bip.Owner}</td>
                    <td>{bip.Type}</td>
                    <td>{bip.Status}</td>
                  </tr>
                )
              }
              else {
                return (
                  <tr key={bip.Number}>
                    <td>
                      <Link href={`/${bip.Number}`}>
                        <a>{bip.Number}</a>
                      </Link>
                    </td>
                    <td>{bip.Layer}</td>
                    <td>{bip.Title}</td>
                    <td>{bip.Owner}</td>
                    <td>{bip.Type}</td>
                    <td>{bip.Status}</td>
                  </tr>
                )
              }
            })
          }
        </tbody>
      </table>
    </>
  )

}

export default Home

export async function getStaticProps() {
  const bips = await import(`../data/bips.json`)
  return {
    props: {
      bips: bips.bips,
    },
  }
}
