import Head from 'next/head'
import Header from '../components/header'
import '../styles/tables.css'
import '../styles/apidoc.css'

const App = ({ Component, pageProps }) =>
(
  <>
    <Head>
      <title>Bitcoin BIPs (Bitcoin Improvement Proposals)</title>
      <link rel="stylesheet" href="https://fonts.xz.style/serve/inter.css" />
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@exampledev/new.css@1.1.3/new.min.css"></link>
      <meta property="og:title" content="Bitcoin BIPs (Bitcoin Improvement Proposals)" key="title" />
      <meta property="og:description" content="A mirror of github BIPs" key="description" />
      <meta property="og:image" content="https://bips.xyz/thumbnail.png" />
      <meta property="og:url" content="https://bips.xyz" />
      <meta name="twitter:card" content="summary" />
    </Head>
    <Header />
    <main>
      <section>
        <Component {...pageProps} />
      </section>
    </main>
  </>
)
export default App