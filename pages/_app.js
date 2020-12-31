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
          <h1 style={{display: 'inline-block'}}>Bitcoin BIPs</h1>
        </div>

        <Link href="/">
          <a>Home</a>
        </Link>
      </nav>
    </header>
    <main>
      <section>
        <Component {...pageProps} />
      </section>
    </main>
    <footer>
      <hr />
      <p>
        <small>Contact info</small>
      </p>
    </footer>
  </>
)
export default App