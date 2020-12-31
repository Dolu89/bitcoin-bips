import Head from 'next/head'
import Header from '../components/header'
import '../styles/tables.css'

const App = ({ Component, pageProps }) =>
(
  <>
    <Head>
      <title>Bitcoin BIPs (Bitcoin Improvement Proposals)</title>
      <link rel="stylesheet" href="https://fonts.xz.style/serve/inter.css" />
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@exampledev/new.css@1.1.2/new.min.css"></link>
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