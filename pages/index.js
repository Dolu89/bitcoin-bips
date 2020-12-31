import Link from 'next/link'
import Utils from '../utils/utils.js'

const Home = props => {
  return (
    <>
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
                      <Link href={`/${Utils.FormatBipAsFile(bip.Number)}`}>
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
  // console.log(bips)
  return {
    props: {
      bips: bips.bips,
    },
  }
}
