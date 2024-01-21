export default interface GithubFile {
  files: {
    path: string
    sha: string
  }[]
}
