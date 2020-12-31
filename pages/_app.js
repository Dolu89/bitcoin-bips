import Head from 'next/head'
import Link from 'next/link'
import '../styles/tables.css'

const App = ({ Component, pageProps }) => (
  <>
    <Head>
      <title>Bitcoin BIPs (Bitcoin Improvement Proposals)</title>
      <link rel="stylesheet" href="https://fonts.xz.style/serve/inter.css" />
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@exampledev/new.css@1.1.2/new.min.css"></link>
    </Head>
    <header>
      <nav>
        <div>
          <h1>Bitcoin BIPs</h1>
        </div>

        <Link href="/">
          <a>Home</a>
        </Link>
        &nbsp;/&nbsp; 
        <a href="https://github.com/dolu89/bitcoin-bips" target="_blank">Github</a>
      </nav>
    </header>
    <main>
      <section>
        <Component {...pageProps} />
      </section>
    </main>
  </>
)
export default App