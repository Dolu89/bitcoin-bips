export default function Api() {
  return (
    <>
      <h1>Api doc</h1>
      <br />

      <h2>All bips</h2>
      <span className="badge">GET</span>
      <pre>https://bips.xyz/api/bips</pre>

      <h3>Parameter</h3>
      <table>
        <thead>
          <tr>
            <th>Field</th>
            <th>Type</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>lastUpdate</td>
            <td>string?</td>
            <td>
              Get only BIPs updated since the `lastUpdate` param. <br />
              <small>
                <strong>Important</strong> Dates come from this project, not the
                from the official Github BIPs repo
              </small>
            </td>
          </tr>
        </tbody>
      </table>

      <h3>Example</h3>
      <pre>https://bips.xyz/api/bips</pre>
      <pre>https://bips.xyz/api/bips?lastUpdate=2021-01-17T22:00:00.000Z</pre>
    </>
  );
}
