import Link from 'next/link'
import axios from 'axios'
import React, { useState, useEffect } from "react";

const Header = () => {
    const [syncState, setSyncState] = useState(<>Loading</>);
    useEffect(async () => {
        const bitcoinRepo = await axios.get('https://api.github.com/repos/bitcoin/bips/commits/master')
        const localRepo = await axios.get('https://api.github.com/repos/dolu89/bips/commits/master')
        if (bitcoinRepo.data.sha === localRepo.data.sha) {
            setSyncState(<span style={{ color: '#0f0' }}>Up to date</span>)
        }
        else {
            setSyncState(<><span style={{ color: '#f00' }}>To update</span> <a href="https://github.com/Dolu89/bitcoin-bips/issues/new">Ask for update</a></>)
        }
    }, []);

    return (
        <header>
            <nav>
                <div style={{ display: 'flex', alignItems: 'baseline' }}>
                    <h1>Bitcoin BIPs</h1>
                    <small style={{marginLeft: '8px'}}>{syncState}</small>
                </div>

                <Link href="/">
                    <a>Home</a>
                </Link>
            &nbsp;/&nbsp;
            <a href="https://github.com/dolu89/bitcoin-bips" target="_blank">Github</a>
            </nav>
        </header>
    )
}

export default Header